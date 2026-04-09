import { useState, useEffect } from 'react';
import { Card, Table, Tag, Space, Button, Modal, Descriptions, Badge, Timeline, Image, Collapse, Popconfirm, message } from 'antd';
import { EyeOutlined, PictureOutlined, DeleteOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Panel } = Collapse;

interface TestReport {
  runId: string;
  suiteName: string;
  status: 'passed' | 'failed' | 'running';
  totalTests: number;
  passed: number;
  failed: number;
  duration: number;
  createdAt: string;
}

interface RunDetail {
  suiteId: string;
  suiteName: string;
  runId: string;
  baseUrl: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  summary: {
    total: number;
    passed: number;
    failed: number;
    aborted: number;
  };
  tests: Array<{
    instanceId: string;
    result: string;
    status: string;
    attempts: Array<{
      status: string;
      steps: Array<{
        id: string;
        action: string;
        target: { value: string };
        status: string;
        errors?: Array<{ message: string }>;
      }>;
    }>;
  }>;
}

interface ScreenshotInfo {
  testId: string;
  stepId: string;
  path: string;
}

export default function Reports() {
  const [reports, setReports] = useState<TestReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [reportDetail, setReportDetail] = useState<RunDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [screenshots, setScreenshots] = useState<ScreenshotInfo[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/reports');
      setReports(res.data);
    } catch (error) {
      console.error('加载报告失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (runId: string) => {
    setDeleting(true);
    try {
      await axios.delete('/api/reports', { data: { runIds: [runId] } });
      message.success('删除成功');
      loadReports();
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) return;
    setDeleting(true);
    try {
      const runIds = selectedRowKeys.map(key => {
        const report = reports.find(r => r.runId === key);
        return report?.runId || key;
      });
      await axios.delete('/api/reports', { data: { runIds } });
      message.success(`成功删除 ${runIds.length} 条记录`);
      setSelectedRowKeys([]);
      loadReports();
    } catch (error) {
      console.error('批量删除失败:', error);
      message.error('批量删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const loadReportDetail = async (runId: string) => {
    setDetailLoading(true);
    setScreenshots([]);
    try {
      // 获取 run.json
      const res = await axios.get(`/api/reports/${runId}/json`);
      setReportDetail(res.data);

      // 获取截图列表
      const screenshotRes = await axios.get(`/api/reports/${runId}/screenshots`);
      setScreenshots(screenshotRes.data);
    } catch (error) {
      console.error('加载报告详情失败:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleViewReport = (runId: string) => {
    setSelectedReport(runId);
    loadReportDetail(runId);
  };

  const getScreenshotsForStep = (testId: string, stepId: string): ScreenshotInfo[] => {
    return screenshots.filter(s =>
      s.testId === testId && (s.stepId === `${stepId}-failure` || s.stepId.includes(stepId))
    );
  };

  const columns = [
    {
      title: '运行ID',
      dataIndex: 'runId',
      key: 'runId',
      render: (id: string) => <code>{id.substring(0, 8)}</code>,
    },
    {
      title: '测试套件',
      dataIndex: 'suiteName',
      key: 'suiteName',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'passed' ? 'success' : status === 'failed' ? 'error' : 'processing'}>
          {status === 'passed' ? '通过' : status === 'failed' ? '失败' : '运行中'}
        </Tag>
      ),
    },
    {
      title: '测试数',
      dataIndex: 'totalTests',
      key: 'totalTests',
    },
    {
      title: '通过/失败',
      key: 'result',
      render: (_: any, record: TestReport) => (
        <Space>
          <Tag color="success">{record.passed}</Tag>
          <Tag color="error">{record.failed}</Tag>
        </Space>
      ),
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      key: 'duration',
      render: (ms: number) => `${(ms / 1000).toFixed(2)}s`,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: TestReport) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewReport(record.runId)}>
            查看
          </Button>
          <Popconfirm
            title="确认删除此报告？"
            onConfirm={() => handleDelete(record.runId)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>测试报告</h1>
        {selectedRowKeys.length > 0 && (
          <Popconfirm
            title={`确认删除选中的 ${selectedRowKeys.length} 条报告？`}
            onConfirm={handleBatchDelete}
            okText="确认"
            cancelText="取消"
          >
            <Button danger icon={<DeleteOutlined />} loading={deleting}>
              批量删除 ({selectedRowKeys.length})
            </Button>
          </Popconfirm>
        )}
      </div>
      <Card>
        <Table
          columns={columns}
          dataSource={reports}
          loading={loading}
          rowKey="runId"
          pagination={{ pageSize: 10 }}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
          }}
        />
      </Card>

      <Modal
        title="测试报告详情"
        open={!!selectedReport}
        onCancel={() => {
          setSelectedReport(null);
          setReportDetail(null);
          setScreenshots([]);
        }}
        width={1000}
        footer={[
          <Button key="close" onClick={() => setSelectedReport(null)}>
            关闭
          </Button>,
        ]}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
        ) : reportDetail ? (
          <div>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="套件ID">{reportDetail.suiteId}</Descriptions.Item>
              <Descriptions.Item label="运行ID">{reportDetail.runId?.substring(0, 8)}</Descriptions.Item>
              <Descriptions.Item label="基础URL">{reportDetail.baseUrl}</Descriptions.Item>
              <Descriptions.Item label="执行引擎">playwright</Descriptions.Item>
              <Descriptions.Item label="开始时间">
                {new Date(reportDetail.startedAt).toLocaleString('zh-CN')}
              </Descriptions.Item>
              <Descriptions.Item label="结束时间">
                {new Date(reportDetail.endedAt).toLocaleString('zh-CN')}
              </Descriptions.Item>
              <Descriptions.Item label="耗时">
                {(reportDetail.durationMs / 1000).toFixed(2)}s
              </Descriptions.Item>
              <Descriptions.Item label="执行结果">
                <Space>
                  <Badge status="success" text={`通过: ${reportDetail.summary?.passed || 0}`} />
                  <Badge status="error" text={`失败: ${reportDetail.summary?.failed || 0}`} />
                </Space>
              </Descriptions.Item>
            </Descriptions>

            <h3 style={{ marginTop: 24 }}>测试用例详情</h3>
            {reportDetail.tests?.map((test, idx) => {
              // 获取最终结果截图
              const finalScreenshots = getScreenshotsForStep(test.instanceId, 'final-result');
              return (
              <Card
                key={idx}
                size="small"
                title={
                  <Space>
                    <code>{test.instanceId}</code>
                    <Tag color={test.result === 'passed' ? 'success' : 'error'}>
                      {test.result === 'passed' ? '通过' : '失败'}
                    </Tag>
                  </Space>
                }
                style={{ marginBottom: 16 }}
              >
                <Collapse defaultActiveKey={['steps']}>
                  <Panel header="执行步骤" key="steps">
                    <Timeline
                      items={test.attempts?.[0]?.steps?.map((step) => {
                        const stepScreenshots = getScreenshotsForStep(test.instanceId, step.id);
                        return {
                          color: step.status === 'passed' ? 'green' : step.status === 'failed' ? 'red' : 'gray',
                          children: (
                            <div>
                              <strong>{step.action}</strong>
                              <div style={{ fontSize: 12, color: '#666' }}>
                                目标: {typeof step.target === 'object' ? step.target?.value : step.target}
                              </div>
                              {step.errors && step.errors.length > 0 && (
                                <div style={{ color: 'red', fontSize: 12, marginTop: 4 }}>
                                  错误: {step.errors[0]?.message?.substring(0, 150)}...
                                </div>
                              )}
                              {stepScreenshots.length > 0 && (
                                <div style={{ marginTop: 8 }}>
                                  <Image.PreviewGroup>
                                    <Space>
                                      <PictureOutlined />
                                      {stepScreenshots.map((screenshot, i) => (
                                        <Image
                                          key={i}
                                          width={100}
                                          src={`/artifacts/${screenshot.path}`}
                                          alt={`${step.id} 截图`}
                                          style={{ border: '1px solid #ddd', borderRadius: 4 }}
                                        />
                                      ))}
                                    </Space>
                                  </Image.PreviewGroup>
                                </div>
                              )}
                            </div>
                          ),
                        };
                      })}
                    />
                    {/* 最终结果截图 */}
                    {finalScreenshots.length > 0 && (
                      <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f0f0f0' }}>
                        <div style={{ marginBottom: 8, fontWeight: 'bold' }}>
                          <PictureOutlined /> 最终结果截图
                        </div>
                        <Image.PreviewGroup>
                          {finalScreenshots.map((screenshot, i) => (
                            <Image
                              key={i}
                              width={150}
                              src={`/artifacts/${screenshot.path}`}
                              alt="最终结果截图"
                              style={{ border: '1px solid #ddd', borderRadius: 4 }}
                            />
                          ))}
                        </Image.PreviewGroup>
                      </div>
                    )}
                  </Panel>
                </Collapse>
              </Card>
            );
            })}
          </div>
        ) : (
          <div>暂无数据</div>
        )}
      </Modal>
    </div>
  );
}
