import { Card, Button, Steps, Space, Alert, Divider, message, List, Tag, Modal, Input, Form, Spin, Progress, Popconfirm, Select, Tabs } from 'antd';
import { VideoCameraOutlined, UploadOutlined, FileOutlined, PlusOutlined, CheckCircleOutlined, SyncOutlined, DeleteOutlined, EyeOutlined, EditOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons';
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

interface Recording {
  name: string;
  chineseName?: string;
  targetUrl?: string;
  status?: 'pending' | 'debugging' | 'completed';
  path: string;
  size: number;
  createdAt: string;
  debugPassed?: boolean;
  lastRunId?: string;
}

// 解析脚本步骤
interface ScriptStep {
  id: number;
  action: string;
  target: string;
  value?: string;
  raw: string;
}

export default function Recorder() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const [recordingModalVisible, setRecordingModalVisible] = useState(false);
  const [recordingContent, setRecordingContent] = useState<string>('');
  const [recordingName, setRecordingName] = useState<string>('');
  const [checkingRecording, setCheckingRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState<{ total: number; current: number; percentage: number }>({ total: 0, current: 0, percentage: 0 });
  const [recordingSteps, setRecordingSteps] = useState<ScriptStep[]>([]);
  const [canSaveRecording, setCanSaveRecording] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [executeStatus, setExecuteStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewName, setPreviewName] = useState('');
  const [executeProgress, setExecuteProgress] = useState<{ percentage: number; currentTest: string; elapsedTime: number }>({ percentage: 0, currentTest: '', elapsedTime: 0 });
  const checkIntervalRef = useRef<number | null>(null);
  const progressRef = useRef({ total: 0, current: 0 });
  const [parsedSteps, setParsedSteps] = useState<ScriptStep[]>([]);
  const [editingStep, setEditingStep] = useState<ScriptStep | null>(null);
  const [savingStep, setSavingStep] = useState(false);

  useEffect(() => {
    loadRecordings();
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, []);

  // 解析 Playwright 脚本为步骤
  const parseScriptToSteps = (script: string): ScriptStep[] => {
    const steps: ScriptStep[] = [];
    const lines = script.split('\n');
    let stepId = 1;

    // 解析 Playwright 操作的辅助函数
    const parseAction = (line: string): ScriptStep | null => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) return null;

      // goto
      let match = trimmed.match(/page\.goto\s*\(\s*['"](.+?)['"]\s*\)/);
      if (match) {
        return { id: stepId++, action: 'goto', target: match[1], raw: trimmed };
      }

      // click / getByRole / getByText / getByLabel 等
      match = trimmed.match(/page\.(click|getBy[A-Za-z]+)\s*\(\s*(.+?)\s*\)/);
      if (match) {
        const action = match[1];
        const args = match[2];
        // 提取第一个字符串参数
        const firstArgMatch = args.match(/['"](.+?)['"]/);
        const target = firstArgMatch ? firstArgMatch[1] : args;
        return { id: stepId++, action: action === 'click' ? 'click' : action, target, raw: trimmed };
      }

      // fill
      match = trimmed.match(/page\.fill\s*\(\s*(.+?)\s*,\s*(.+?)\s*\)/);
      if (match) {
        const target = match[1].replace(/['"]/g, '');
        const value = match[2].replace(/['"]/g, '');
        return { id: stepId++, action: 'fill', target, value, raw: trimmed };
      }

      // type
      match = trimmed.match(/page\.type\s*\(\s*(.+?)\s*,\s*(.+?)\s*\)/);
      if (match) {
        const target = match[1].replace(/['"]/g, '');
        const value = match[2].replace(/['"]/g, '');
        return { id: stepId++, action: 'type', target, value, raw: trimmed };
      }

      // press
      match = trimmed.match(/page\.press\s*\(\s*(.+?)\s*,\s*(.+?)\s*\)/);
      if (match) {
        const target = match[1].replace(/['"]/g, '');
        const value = match[2].replace(/['"]/g, '');
        return { id: stepId++, action: 'press', target, value, raw: trimmed };
      }

      // selectOption
      match = trimmed.match(/page\.selectOption\s*\(\s*(.+?)\s*,\s*(.+?)\s*\)/);
      if (match) {
        const target = match[1].replace(/['"]/g, '');
        const value = match[2].replace(/['"]/g, '');
        return { id: stepId++, action: 'selectOption', target, value, raw: trimmed };
      }

      // check / uncheck / hover
      match = trimmed.match(/page\.(check|uncheck|hover)\s*\(\s*(.+?)\s*\)/);
      if (match) {
        const target = match[2].replace(/['"]/g, '');
        return { id: stepId++, action: match[1], target, raw: trimmed };
      }

      // waitForSelector
      match = trimmed.match(/page\.waitForSelector\s*\(\s*(.+?)\s*\)/);
      if (match) {
        const target = match[1].replace(/['"]/g, '');
        return { id: stepId++, action: 'waitForSelector', target, raw: trimmed };
      }

      return null;
    };

    for (const line of lines) {
      const step = parseAction(line);
      if (step) {
        steps.push(step);
      }
    }

    return steps;
  };

  const loadRecordings = async () => {
    try {
      const { data } = await axios.get('/api/v1/recordings');
      setRecordings(data);
    } catch (error) {
      console.error('Failed to load recordings:', error);
    }
  };

  const handleDeleteRecording = async (name: string) => {
    try {
      await axios.delete(`/api/v1/recordings/${name}`);
      message.success('删除成功');
      loadRecordings();
    } catch (error) {
      console.error('Failed to delete recording:', error);
      message.error('删除失败');
    }
  };

  const handlePreviewRecording = async (item: Recording) => {
    try {
      const { data } = await axios.get(`/api/v1/recordings/${item.name}/content`);
      setPreviewName(item.chineseName || item.name);
      setPreviewContent(data.content);
      // 解析脚本为步骤
      const steps = parseScriptToSteps(data.content);
      setParsedSteps(steps);
      setPreviewModalVisible(true);
    } catch (error) {
      console.error('Failed to preview recording:', error);
      message.error('预览失败');
    }
  };

  const handleCreateRecording = async (values: { name: string; targetUrl: string }) => {
    setCreating(true);
    try {
      await axios.post('/api/v1/recordings', { name: values.name, targetUrl: values.targetUrl });
      message.success('脚本创建成功！');
      setCreateModalVisible(false);
      loadRecordings();
    } catch (error) {
      console.error('Failed to create recording:', error);
      message.error('创建失败');
    } finally {
      setCreating(false);
    }
  };

  // 执行/回放脚本 - 并在弹窗中显示结果
  const handleExecuteRecording = async (item: Recording) => {
    try {
      message.info('开始执行脚本...');

      const { data } = await axios.post(`/api/v1/recordings/${item.name}/execute`);
      const runId = data.runId;

      // 设置当前正在执行的脚本
      setRecordingName(item.name);

      // 设置执行状态为运行中
      setExecuting(true);
      setExecuteStatus('running');
      setExecuteProgress({ percentage: 0, currentTest: '开始执行...', elapsedTime: 0 });
      setRecordingModalVisible(true);

      const startTime = Date.now();

      // 轮询检查执行结果
      const checkStatus = setInterval(async () => {
        try {
          const statusRes = await axios.get(`/api/reports/${runId}/json`).catch(() => ({ data: null }));
          if (statusRes.data) {
            clearInterval(checkStatus);
            const duration = statusRes.data.durationMs || 0;
            const passed = statusRes.data.summary?.passed || 0;
            const failed = statusRes.data.summary?.failed || 0;
            const total = statusRes.data.summary?.total || 0;

            setExecuteProgress({ percentage: 100, currentTest: '执行完成', elapsedTime: duration });

            if (failed > 0) {
              setExecuteStatus('failed');
              message.error(`执行失败：${failed} 个测试失败`);

              // 更新脚本状态为待调试
              await axios.patch(`/api/v1/recordings/${item.name}/status`, { status: 'pending', lastRunId: runId, debugPassed: false });
            } else {
              setExecuteStatus('success');
              message.success(`执行成功：${passed} 个测试通过`);

              // 更新脚本状态为已调试通过
              await axios.patch(`/api/v1/recordings/${item.name}/status`, { status: 'completed', lastRunId: runId, debugPassed: true });

              // 同步到执行测试页
              const syncedScripts = JSON.parse(localStorage.getItem('syncedScripts') || '[]');
              const scriptInfo = {
                name: item.chineseName || item.name,
                path: `recordings/${item.name}`,
                label: `🎬 ${item.chineseName || item.name} (录制)`,
                targetUrl: item.targetUrl,
              };
              // 检查是否已存在
              const exists = syncedScripts.find((s: any) => s.path === scriptInfo.path);
              if (!exists) {
                syncedScripts.push(scriptInfo);
                localStorage.setItem('syncedScripts', JSON.stringify(syncedScripts));
                message.success('脚本已同步到执行测试页');
              }
            }

            setExecuting(false);
            loadRecordings();
          }
        } catch (e) {
          // 忽略错误，继续等待
        }
      }, 1000);

      // 60秒超时
      setTimeout(() => {
        clearInterval(checkStatus);
        if (executing) {
          setExecuteStatus('failed');
          setExecuting(false);
          message.error('执行超时');
        }
      }, 60000);

    } catch (error) {
      console.error('Failed to execute recording:', error);
      message.error('执行失败');
    }
  };

  // 录制新脚本 - 启动录制器
  const handleRecordNew = async (item: Recording) => {
    // 从文件名中提取场景名称（去掉时间戳和扩展名）
    const name = item.name.replace(/-\d+\.(js|ts|json)$/, '').replace(/\.(js|ts|json)$/, '');
    try {
      message.info('即将启动浏览器录制器...');
      // 使用保存的目标网址启动录制器
      await axios.post('/api/v1/record/start', { name, targetUrl: item.targetUrl });
      message.success('录制器已启动，请在浏览器中进行操作');
      message.info('录制完成后，请关闭浏览器窗口');

      // 初始化进度状态
      setCheckingRecording(true);
      setRecordingProgress({ total: 0, current: 0, percentage: 0 });
      progressRef.current = { total: 0, current: 0 };
      setRecordingSteps([]);
      setCanSaveRecording(false);
      setRecordingModalVisible(true);

      const startTime = Date.now();
      let lastFileSize = 0;

      checkIntervalRef.current = window.setInterval(async () => {
        try {
          const { data } = await axios.get(`/api/v1/recordings/check?since=${startTime}`);
          if (data.newFiles && data.newFiles.length > 0) {
            // 发现新文件，获取最新一个
            const latestFile = data.newFiles[data.newFiles.length - 1];
            const contentRes = await axios.get(`/api/v1/recordings/${latestFile}/content`);
            const content = contentRes.data.content;

            // 解析脚本步骤
            const steps = parseScriptToSteps(content);
            const totalSteps = steps.length;

            setRecordingName(latestFile);
            setRecordingContent(content);

            // 如果有步骤，显示步骤和进度
            if (totalSteps > 0) {
              setRecordingSteps(steps);

              // 逐步增加进度
              const currentProgress = progressRef.current.current;
              if (currentProgress < totalSteps) {
                // 每次检查增加一步
                const newCurrent = currentProgress + 1;
                const newPercentage = Math.round((newCurrent / totalSteps) * 100);
                progressRef.current = { total: totalSteps, current: newCurrent };
                setRecordingProgress({
                  total: totalSteps,
                  current: newCurrent,
                  percentage: newPercentage
                });
              }

              // 检测录制完成：检查脚本是否包含 browser.close() 或 context.close()
              const isComplete = content.includes('browser.close()') || content.includes('context.close()');

              if (isComplete) {
                // 录制完成
                if (checkIntervalRef.current) {
                  clearInterval(checkIntervalRef.current);
                  checkIntervalRef.current = null;
                }
                progressRef.current = { total: totalSteps, current: totalSteps };
                setRecordingProgress({ total: totalSteps, current: totalSteps, percentage: 100 });
                setCheckingRecording(false);
                setCanSaveRecording(true);
                message.success('录制完成！');
                loadRecordings();
              } else {
                // 录制中，显示当前进度
                setCheckingRecording(true);
              }
            }
          }
        } catch (e) {
          console.error('Check recording error:', e);
        }
      }, 2000);

      // 60秒超时
      setTimeout(() => {
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
          checkIntervalRef.current = null;
        }
        // 超时时如果已有内容，也启用保存
        if (recordingContent) {
          setCheckingRecording(false);
          setCanSaveRecording(true);
        } else {
          setCheckingRecording(false);
          setRecordingModalVisible(false);
          message.warning('录制超时，请重试');
        }
      }, 60000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      message.error('启动录制器失败');
    }
  };

  const handleSaveRecording = async () => {
    if (!canSaveRecording) {
      message.warning('请等待录制完成后再保存');
      return;
    }
    try {
      // 更新状态为已完成
      if (recordingName) {
        await axios.patch(`/api/v1/recordings/${recordingName}/status`, { status: 'completed' });
      }
      setRecordingModalVisible(false);
      setRecordingContent('');
      setRecordingName('');
      setRecordingSteps([]);
      setRecordingProgress({ total: 0, current: 0, percentage: 0 });
      setCanSaveRecording(false);
      setCheckingRecording(false);
      loadRecordings();
      message.success('脚本已保存');
    } catch (error) {
      console.error('Failed to save:', error);
      message.error('保存失败');
    }
  };

  // 删除步骤
  const handleDeleteStep = (stepId: number) => {
    const newSteps = parsedSteps.filter(s => s.id !== stepId);
    setParsedSteps(newSteps);
    // 重新生成脚本内容
    const newContent = generateScriptFromSteps(newSteps);
    setPreviewContent(newContent);
    message.success('步骤已删除');
  };

  // 开始编辑步骤
  const handleEditStep = (step: ScriptStep) => {
    setEditingStep({ ...step });
  };

  // 保存编辑的步骤
  const handleSaveStep = async () => {
    if (!editingStep) return;
    setSavingStep(true);

    const newSteps = parsedSteps.map(s =>
      s.id === editingStep.id ? editingStep : s
    );
    setParsedSteps(newSteps);
    // 重新生成脚本内容
    const newContent = generateScriptFromSteps(newSteps);
    setPreviewContent(newContent);
    setEditingStep(null);
    setSavingStep(false);
    message.success('步骤已更新');
  };

  // 取消编辑步骤
  const handleCancelEdit = () => {
    setEditingStep(null);
  };

  // 从步骤生成脚本
  const generateScriptFromSteps = (steps: ScriptStep[]): string => {
    const lines: string[] = [
      "const { chromium } = require('playwright');",
      '',
      '(async () => {',
      "  const browser = await chromium.launch({ headless: false });",
      '  const context = await browser.newContext();',
      '  const page = await context.newPage();',
      '',
    ];

    for (const step of steps) {
      switch (step.action) {
        case 'goto':
          lines.push(`  await page.goto('${step.target}');`);
          break;
        case 'click':
          lines.push(`  await page.click('${step.target}');`);
          break;
        case 'fill':
          lines.push(`  await page.fill('${step.target}', '${step.value || ''}');`);
          break;
        case 'type':
          lines.push(`  await page.type('${step.target}', '${step.value || ''}');`);
          break;
        case 'press':
          lines.push(`  await page.press('${step.target}', '${step.value || ''}');`);
          break;
        case 'selectOption':
          lines.push(`  await page.selectOption('${step.target}', '${step.value || ''}');`);
          break;
        case 'check':
          lines.push(`  await page.check('${step.target}');`);
          break;
        case 'uncheck':
          lines.push(`  await page.uncheck('${step.target}');`);
          break;
        case 'hover':
          lines.push(`  await page.hover('${step.target}');`);
          break;
        case 'waitForSelector':
          lines.push(`  await page.waitForSelector('${step.target}');`);
          break;
        default:
          lines.push(`  // ${step.action}: ${step.target}`);
      }
    }

    lines.push('');
    lines.push('  // ---------------------');
    lines.push('  await context.close();');
    lines.push('  await browser.close();');
    lines.push('})();');

    return lines.join('\n');
  };

  // 保存修改后的脚本到服务器
  const handleSaveModifiedScript = async () => {
    if (!previewName) return;
    try {
      // 查找对应的 recording
      const recording = recordings.find(r => (r.chineseName || r.name) === previewName);
      if (recording) {
        // 调用保存 API
        await axios.put(`/api/v1/recordings/${recording.name}/content`, {
          content: previewContent
        });
        message.success('脚本已保存');
        setPreviewModalVisible(false);
        loadRecordings();
      }
    } catch (error) {
      console.error('Failed to save script:', error);
      message.error('保存失败');
    }
  };

  // 调试执行 - 更新状态并运行
  const handleDebugRecording = async () => {
    if (!recordingName) return;
    setExecuting(true);
    setExecuteStatus('running');
    setExecuteProgress({ percentage: 0, currentTest: '开始执行...', elapsedTime: 0 });

    try {
      // 更新状态为调试中
      await axios.patch(`/api/v1/recordings/${recordingName}/status`, { status: 'debugging' });
      loadRecordings();

      const { data } = await axios.post(`/api/v1/recordings/${recordingName}/execute`);
      const runId = data.runId;

      // 轮询检查执行状态
      const checkStatus = setInterval(async () => {
        try {
          const statusRes = await axios.get(`/api/reports/${runId}/json`).catch(() => ({ data: null }));
          if (statusRes.data) {
            clearInterval(checkStatus);
            const duration = statusRes.data.durationMs || 0;
            const passed = statusRes.data.summary?.passed || 0;
            const failed = statusRes.data.summary?.failed || 0;

            setExecuteProgress({ percentage: 100, currentTest: '执行完成', elapsedTime: duration });
            setExecuteStatus(failed > 0 ? 'failed' : 'success');
            setExecuting(false);

            // 更新状态为已完成或待调试
            await axios.patch(`/api/v1/recordings/${recordingName}/status`, { status: failed > 0 ? 'pending' : 'completed' });
            loadRecordings();

            if (failed > 0) {
              message.error(`执行失败：${failed} 个测试失败`);
            } else {
              message.success(`执行成功：${passed} 个测试通过`);
            }
          }
        } catch (e) {
          // 忽略错误，继续等待
        }
      }, 1000);

      // 60秒超时
      setTimeout(() => {
        clearInterval(checkStatus);
        if (executing) {
          setExecuteStatus('failed');
          setExecuting(false);
          message.error('执行超时');
        }
      }, 60000);

    } catch (error) {
      console.error('Failed to execute:', error);
      setExecuteStatus('failed');
      setExecuting(false);
      message.error('执行失败');
    }
  };

  const localRecordingSteps = [
    {
      title: '安装 Playwright',
      description: '确保已安装 Playwright',
      command: 'npm install -g playwright',
    },
    {
      title: '启动录制器',
      description: '在终端运行以下命令',
      command: 'npx playwright codegen --target=javascript -o my-test.js',
    },
    {
      title: '录制操作',
      description: '在打开的浏览器中进行操作',
      command: '浏览器自动打开',
    },
    {
      title: '停止录制',
      description: '按 Ctrl+C 停止录制',
      command: 'Ctrl + C',
    },
    {
      title: '导入脚本',
      description: '将生成的脚本导入到 Testergizer',
      command: '使用下方导入按钮',
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>录制脚本</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
          新建脚本
        </Button>
      </div>

      <Steps
        current={0}
        style={{ marginBottom: 24 }}
        items={[
          { title: '本地录制', description: '使用 Playwright' },
          { title: '导入脚本', description: '上传到平台' },
          { title: '执行验证', description: '运行测试' },
        ]}
      />

      <Card title="如何录制脚本" style={{ marginBottom: 24 }}>
        <Alert
          message="本地录制方式"
          description={
            <div>
              <p>由于浏览器录制需要在本地图形界面运行，请按以下步骤在本地进行录制：</p>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <List
          bordered
          dataSource={localRecordingSteps}
          renderItem={(item, index) => (
            <List.Item>
              <List.Item.Meta
                avatar={
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: '#1890ff',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold'
                  }}>
                    {index + 1}
                  </div>
                }
                title={item.title}
                description={
                  <div>
                    <div>{item.description}</div>
                    {item.command && item.command !== '浏览器自动打开' && item.command !== 'Ctrl + C' && (
                      <code style={{
                        display: 'block',
                        background: '#f5f5f5',
                        padding: '8px 12px',
                        borderRadius: 4,
                        marginTop: 8,
                        fontFamily: 'monospace'
                      }}>
                        {item.command}
                      </code>
                    )}
                  </div>
                }
              />
            </List.Item>
          )}
        />

        <Divider />

        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <h4>快速开始：</h4>
            <ol style={{ paddingLeft: 20 }}>
              <li>打开终端</li>
              <li>运行 <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: 4 }}>cd /你的项目目录</code></li>
              <li>运行 <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: 4 }}>npx playwright codegen https://www.saucedemo.com -o test.js</code></li>
              <li>在浏览器中登录 saucedemo (用户名: standard_user, 密码: secret_sauce)</li>
              <li>按 <Tag>Ctrl + C</Tag> 停止录制</li>
              <li>回到下方导入录制的脚本</li>
            </ol>
          </div>
        </Space>
      </Card>

      <Card title="导入脚本">
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Alert
            message="支持的脚本格式"
            description={
              <div>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li><strong>Playwright</strong> - JavaScript/TypeScript 脚本 (.js, .ts)</li>
                  <li><strong>Testergizer</strong> - JSON 格式测试定义</li>
                </ul>
              </div>
            }
            type="success"
            showIcon
          />

          <div>
            <input
              type="file"
              accept=".js,.ts,.json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                const formData = new FormData();
                formData.append('file', file);

                setLoading(true);
                try {
                  await axios.post('/api/import', formData);
                  message.success('脚本导入成功！');
                  loadRecordings();
                } catch (error: any) {
                  message.error(error.response?.data?.error || '导入失败');
                } finally {
                  setLoading(false);
                }
              }}
              style={{ display: 'none' }}
              id="file-upload"
            />
            <label htmlFor="file-upload">
              <Button type="primary" icon={<UploadOutlined />} loading={loading}>
                选择文件导入
              </Button>
            </label>
          </div>

          {recordings.length > 0 && (
            <>
              <Divider>已导入的脚本</Divider>
              <List
                size="small"
                dataSource={recordings}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Button key="record" type="link" icon={<VideoCameraOutlined />} onClick={() => handleRecordNew(item)}>
                        录制
                      </Button>,
                      <Button key="run" type="link" icon={<SyncOutlined />} onClick={() => handleExecuteRecording(item)}>
                        {item.status === 'completed' ? '重新执行' : '执行'}
                      </Button>,
                      <Button key="preview" type="link" icon={<EyeOutlined />} onClick={() => handlePreviewRecording(item)}>
                        预览
                      </Button>,
                      <Popconfirm
                        key="delete"
                        title="确认删除此脚本？"
                        onConfirm={() => handleDeleteRecording(item.name)}
                        okText="确认"
                        cancelText="取消"
                      >
                        <Button type="link" danger icon={<DeleteOutlined />}>
                          删除
                        </Button>
                      </Popconfirm>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<FileOutlined />}
                      title={
                        <Space>
                          <span>{item.chineseName || item.name}</span>
                          <Tag color={item.status === 'completed' ? 'green' : item.status === 'debugging' ? 'blue' : 'default'}>
                            {item.status === 'completed' ? '已调试' : item.status === 'debugging' ? '调试中' : '待调试'}
                          </Tag>
                          {item.lastRunId && (
                            <Tag color={item.status === 'completed' ? 'success' : 'error'}>
                              {item.status === 'completed' ? '✓ 通过' : '✗ 失败'}
                            </Tag>
                          )}
                        </Space>
                      }
                      description={
                        <div>
                          <div>{item.name}</div>
                          <div style={{ fontSize: 12, color: '#888' }}>
                            目标: {item.targetUrl || '-'} | {(item.size / 1024).toFixed(1)} KB | {new Date(item.createdAt).toLocaleString('zh-CN')}
                          </div>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            </>
          )}
        </Space>
      </Card>

      <Modal
        title="新建脚本"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        destroyOnClose
      >
        <Form layout="vertical" onFinish={handleCreateRecording} autoComplete="off">
          <Form.Item
            label="业务场景名称"
            name="name"
            rules={[{ required: true, message: '请输入业务场景名称' }]}
          >
            <Input placeholder="例如：用户登录、订单提交" />
          </Form.Item>
          <Form.Item
            label="目标网址"
            name="targetUrl"
            rules={[{ required: true, message: '请输入目标网址' }]}
          >
            <Input placeholder="例如：https://www.example.com" />
          </Form.Item>
          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setCreateModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={creating}>
                创建
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 录制结果弹窗 */}
      <Modal
        title={`录制结果 - ${recordingName}`}
        open={recordingModalVisible}
        onCancel={() => {
          if (canSaveRecording) {
            setRecordingModalVisible(false);
            setRecordingContent('');
            setRecordingName('');
            setRecordingSteps([]);
            setRecordingProgress({ total: 0, current: 0, percentage: 0 });
            setCanSaveRecording(false);
          }
        }}
        width={800}
        footer={[
          <Button key="debug" type="primary" icon={<SyncOutlined />} onClick={handleDebugRecording} loading={executing}>
            调试执行
          </Button>,
          <Button key="save" type="primary" icon={<CheckCircleOutlined />} onClick={handleSaveRecording} disabled={!canSaveRecording}>
            {canSaveRecording ? '保存结果' : '等待录制完成...'}
          </Button>,
        ]}
        destroyOnClose
      >
        {checkingRecording || recordingSteps.length > 0 ? (
          <div>
            {/* 进度条 */}
            {recordingSteps.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <Alert
                  type="info"
                  message={`步骤解析中: ${recordingProgress.current} / ${recordingProgress.total}`}
                  description={canSaveRecording ? '录制完成，可以保存结果' : '请在浏览器中继续操作...'}
                />
                <Progress
                  percent={recordingProgress.percentage}
                  status={canSaveRecording ? 'success' : 'active'}
                  style={{ marginTop: 8 }}
                />
              </div>
            )}

            {/* 步骤列表 */}
            {recordingSteps.length > 0 ? (
              <div style={{ maxHeight: 400, overflow: 'auto' }}>
                <List
                  dataSource={recordingSteps}
                  renderItem={(step) => (
                    <Card size="small" style={{ marginBottom: 8 }}>
                      <List.Item.Meta
                        avatar={
                          <div style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: step.id <= recordingProgress.current ? '#52c41a' : '#d9d9d9',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12
                          }}>
                            {step.id <= recordingProgress.current ? '✓' : step.id}
                          </div>
                        }
                        title={
                          <Space>
                            <Tag color={getActionColor(step.action)}>{getActionLabel(step.action)}</Tag>
                            {step.action === 'goto' && <span style={{ color: '#1890ff' }}>{step.target}</span>}
                          </Space>
                        }
                        description={
                          <div style={{ fontSize: 12 }}>
                            <div>目标: <code>{step.target || '-'}</code></div>
                            {step.value && <div>值: <code>{step.value}</code></div>}
                          </div>
                        }
                      />
                    </Card>
                  )}
                />
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin size="large" />
                <p>等待录制完成...</p>
                <p style={{ color: '#666' }}>请在浏览器中进行操作，录制完成后关闭浏览器窗口</p>
              </div>
            )}
          </div>
        ) : (
          <>
            {executeStatus !== 'idle' && (
              <div style={{ marginBottom: 16 }}>
                <Alert
                  type={executeStatus === 'success' ? 'success' : executeStatus === 'failed' ? 'error' : 'info'}
                  message={
                    executeStatus === 'running'
                      ? `执行中: ${executeProgress.currentTest} (${(executeProgress.elapsedTime / 1000).toFixed(1)}s)`
                      : executeStatus === 'success'
                      ? '执行成功！所有测试通过'
                      : '执行失败，请检查脚本'
                  }
                />
                {executeStatus === 'running' && (
                  <Progress percent={executeProgress.percentage} status="active" style={{ marginTop: 8 }} />
                )}
              </div>
            )}
            <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, maxHeight: 400, overflow: 'auto' }}>
              <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {recordingContent}
              </pre>
            </div>
          </>
        )}
      </Modal>

      {/* 预览弹窗 */}
      <Modal
        title={`脚本预览 - ${previewName}`}
        open={previewModalVisible}
        onCancel={() => {
          setPreviewModalVisible(false);
          setEditingStep(null);
        }}
        width={900}
        footer={[
          <Button key="save" type="primary" icon={<SaveOutlined />} onClick={handleSaveModifiedScript}>
            保存修改
          </Button>,
          <Button key="close" onClick={() => {
            setPreviewModalVisible(false);
            setEditingStep(null);
          }}>
            关闭
          </Button>,
        ]}
      >
        <Tabs
          defaultActiveKey="steps"
          items={[
            {
              key: 'steps',
              label: '步骤可视化',
              children: (
                <div style={{ maxHeight: 500, overflow: 'auto' }}>
                  {parsedSteps.length === 0 ? (
                    <Alert message="无法解析脚本步骤，请查看原始代码" type="warning" />
                  ) : (
                    <List
                      dataSource={parsedSteps}
                      renderItem={(step) => (
                        <Card
                          size="small"
                          style={{ marginBottom: 12 }}
                          actions={
                            editingStep?.id === step.id
                              ? [
                                  <Button key="save" type="link" icon={<SaveOutlined />} onClick={handleSaveStep} loading={savingStep}>保存</Button>,
                                  <Button key="cancel" type="link" icon={<CloseOutlined />} onClick={handleCancelEdit}>取消</Button>,
                                ]
                              : [
                                  <Button key="edit" type="link" icon={<EditOutlined />} onClick={() => handleEditStep(step)}>编辑</Button>,
                                  <Popconfirm
                                    key="delete"
                                    title="确认删除此步骤？"
                                    onConfirm={() => handleDeleteStep(step.id)}
                                    okText="确认"
                                    cancelText="取消"
                                  >
                                    <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
                                  </Popconfirm>,
                                ]
                          }
                        >
                          {editingStep?.id === step.id ? (
                            <Form layout="vertical">
                              <Form.Item label="操作类型">
                                <Select
                                  value={editingStep.action}
                                  onChange={(value) => setEditingStep({ ...editingStep, action: value })}
                                  options={[
                                    { value: 'goto', label: '打开页面 (goto)' },
                                    { value: 'click', label: '点击 (click)' },
                                    { value: 'fill', label: '填写 (fill)' },
                                    { value: 'type', label: '输入 (type)' },
                                    { value: 'press', label: '按键 (press)' },
                                    { value: 'selectOption', label: '选择选项 (selectOption)' },
                                    { value: 'check', label: '勾选 (check)' },
                                    { value: 'hover', label: '悬停 (hover)' },
                                    { value: 'waitForSelector', label: '等待元素 (waitForSelector)' },
                                  ]}
                                />
                              </Form.Item>
                              <Form.Item label="目标元素">
                                <Input
                                  value={editingStep.target}
                                  onChange={(e) => setEditingStep({ ...editingStep, target: e.target.value })}
                                  placeholder="例如: #username, button.submit"
                                />
                              </Form.Item>
                              {['fill', 'type', 'press', 'selectOption'].includes(editingStep.action) && (
                                <Form.Item label="值">
                                  <Input
                                    value={editingStep.value}
                                    onChange={(e) => setEditingStep({ ...editingStep, value: e.target.value })}
                                    placeholder="输入的值"
                                  />
                                </Form.Item>
                              )}
                            </Form>
                          ) : (
                            <List.Item.Meta
                              avatar={
                                <div style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: '50%',
                                  background: getActionColor(step.action),
                                  color: '#fff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 'bold',
                                  fontSize: 12
                                }}>
                                  {step.id}
                                </div>
                              }
                              title={
                                <Space>
                                  <Tag color={getActionColor(step.action)}>{getActionLabel(step.action)}</Tag>
                                  {step.action === 'goto' && <span style={{ color: '#1890ff' }}>{step.target}</span>}
                                </Space>
                              }
                              description={
                                <div>
                                  <div>目标: <code>{step.target || '-'}</code></div>
                                  {step.value && <div>值: <code>{step.value}</code></div>}
                                  <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{step.raw}</div>
                                </div>
                              }
                            />
                          )}
                        </Card>
                      )}
                    />
                  )}
                </div>
              ),
            },
            {
              key: 'code',
              label: '原始代码',
              children: (
                <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, maxHeight: 500, overflow: 'auto' }}>
                  <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {previewContent}
                  </pre>
                </div>
              ),
            },
          ]}
        />
      </Modal>
    </div>
  );
}

// 获取操作类型标签
function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    goto: '打开页面',
    click: '点击',
    fill: '填写',
    type: '输入',
    press: '按键',
    selectOption: '选择',
    check: '勾选',
    uncheck: '取消勾选',
    hover: '悬停',
    scroll: '滚动',
    waitForSelector: '等待元素',
    waitForNavigation: '等待导航',
    screenshot: '截图',
    newContext: '新建上下文',
    newPage: '新建页面',
  };
  return labels[action] || action;
}

// 获取操作类型颜色
function getActionColor(action: string): string {
  const colors: Record<string, string> = {
    goto: 'blue',
    click: 'green',
    fill: 'orange',
    type: 'purple',
    press: 'cyan',
    selectOption: 'geekblue',
    check: 'green',
    uncheck: 'red',
    hover: 'gold',
    scroll: 'lime',
    waitForSelector: 'magenta',
    waitForNavigation: 'blue',
    screenshot: 'volcano',
    newContext: 'default',
    newPage: 'default',
  };
  return colors[action] || 'default';
}
