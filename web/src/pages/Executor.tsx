import { useState, useEffect } from 'react';
import { Card, Button, Space, Select, InputNumber, Progress, Alert, Divider, message } from 'antd';
import { PlayCircleOutlined, SettingOutlined, SyncOutlined } from '@ant-design/icons';
import axios from 'axios';
import { useExecution } from '../hooks/useExecution';

const { Option } = Select;

const examples = [
  { value: 'examples/v2-qpmcn/suite.qpmcn.json', label: '🔐 QPMCN 登录测试 (录制)' },
  { value: 'examples/v2-api-variance/suites/suite.api.json', label: 'API 测试示例' },
  { value: 'examples/v2-demosauce/suites/suite.demosauce.json', label: 'UI 测试示例 (SauceDemo)' },
  { value: 'examples/v2-fullstack/suites/suite.fullstack.json', label: '全栈测试示例' },
];

interface SyncedScript {
  name: string;
  path: string;
  label: string;
  targetUrl?: string;
}

export default function Executor() {
  const { execute, progress, isRunning, error } = useExecution();
  const [selectedSuite, setSelectedSuite] = useState('');
  const [workers, setWorkers] = useState(1);
  const [autVersion, setAutVersion] = useState('1.0.0');
  const [syncedScripts, setSyncedScripts] = useState<SyncedScript[]>([]);

  useEffect(() => {
    // 加载同步的脚本
    const loadSyncedScripts = () => {
      const saved = localStorage.getItem('syncedScripts');
      if (saved) {
        try {
          setSyncedScripts(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to parse synced scripts:', e);
        }
      }
    };
    loadSyncedScripts();

    // 监听 localStorage 变化（跨页面同步）
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'syncedScripts') {
        loadSyncedScripts();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // 移除同步的脚本
  const handleRemoveSyncedScript = (path: string) => {
    const updated = syncedScripts.filter(s => s.path !== path);
    setSyncedScripts(updated);
    localStorage.setItem('syncedScripts', JSON.stringify(updated));
    message.success('已从执行列表中移除');
  };

  // 合并示例脚本和同步脚本
  const allSuites = [
    ...examples,
    ...syncedScripts.map(s => ({ value: s.path, label: s.label }))
  ];

  const handleExecute = async () => {
    if (!selectedSuite) {
      message.error('请选择测试套件');
      return;
    }

    // 判断是否是录制脚本（JS文件）
    const isRecording = selectedSuite.startsWith('recordings/') && selectedSuite.endsWith('.js');

    if (isRecording) {
      // 使用录制脚本执行 API
      const scriptName = selectedSuite.replace('recordings/', '');
      try {
        const { data } = await axios.post(`/api/v1/recordings/${scriptName}/execute`);
        const runId = data.runId;
        message.success(`脚本已启动执行！\nrunId: ${runId.substring(0, 12)}...`);
        setTimeout(() => {
          message.info('请前往"测试报告"页面查看执行结果');
        }, 3000);
      } catch (err: any) {
        message.error(err.response?.data?.error || '执行失败');
      }
    } else {
      // 使用测试套件执行 API
      await execute({
        suitePath: selectedSuite,
        engine: 'playwright',
        workers,
        autVersion,
      });
    }
  };

  return (
    <div>
      <h1>执行测试</h1>

      <Card title="测试配置" extra={<SettingOutlined />}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <label>测试套件：</label>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              placeholder="请选择测试套件"
              value={selectedSuite}
              onChange={setSelectedSuite}
              dropdownRender={(menu) => (
                <>
                  {menu}
                  {syncedScripts.length > 0 && (
                    <>
                      <Divider style={{ margin: '8px 0' }} />
                      <div style={{ padding: '4px 8px', color: '#888', fontSize: 12 }}>
                        <SyncOutlined /> 已同步的录制脚本
                      </div>
                      {syncedScripts.map((s) => (
                        <div
                          key={s.path}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '4px 8px',
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            setSelectedSuite(s.path);
                          }}
                        >
                          <span>{s.label}</span>
                          <Button
                            type="text"
                            size="small"
                            danger
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveSyncedScript(s.path);
                            }}
                          >
                            移除
                          </Button>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}
            >
              {allSuites.map((ex) => (
                <Option key={ex.value} value={ex.value}>
                  {ex.label}
                </Option>
              ))}
            </Select>
          </div>

          <div style={{ display: 'flex', gap: 24 }}>
            <div style={{ flex: 1 }}>
              <label>并发数：</label>
              <InputNumber
                style={{ width: '100%', marginTop: 8 }}
                min={1}
                max={10}
                value={workers}
                onChange={(v) => setWorkers(v || 1)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label>版本号：</label>
              <InputNumber
                style={{ width: '100%', marginTop: 8 }}
                value={autVersion}
                onChange={(v) => setAutVersion(v as string)}
              />
            </div>
          </div>

          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            size="large"
            block
            loading={isRunning}
            onClick={handleExecute}
          >
            {isRunning ? '执行中...' : '开始执行'}
          </Button>
        </Space>
      </Card>

      {error && (
        <>
          <Divider />
          <Alert type="error" message="执行错误" description={error} showIcon />
        </>
      )}

      {isRunning && progress && (
        <>
          <Divider />
          <Card title="执行进度">
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Progress
                  percent={Math.round(progress.percentage)}
                  status="active"
                  strokeColor={{ from: '#108ee9', to: '#87d068' }}
                />
              </div>
              <div>当前测试：{progress.currentTest || '初始化中...'}</div>
              <div>步骤：{progress.currentStep || 0} / {progress.totalSteps || 0}</div>
              <div>已运行：{progress.elapsedTime}ms</div>
            </Space>
          </Card>
        </>
      )}
    </div>
  );
}
