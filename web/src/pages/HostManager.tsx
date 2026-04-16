import { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Space, Input, Select, Modal, Form, Descriptions, Steps, Badge, Row, Col, Statistic, message, Popconfirm, Drawer, List, Divider } from 'antd';
import { SearchOutlined, ReloadOutlined, DesktopOutlined, PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined, MessageOutlined, ShopOutlined, DatabaseOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Option } = Select;

// 类型定义 (后端返回 snake_case)
interface Host {
  ip: string;
  hostname: string;
  status: 'online' | 'offline' | 'alert';
  task_count: number;
  last_active_at: string;
  tags: string[];
}

interface Task {
  task_id: string;
  name: string;
  host_ip: string;
  status: 'running' | 'completed' | 'failed' | 'pending';
  started_at: string;
  completed_at?: string;
  duration?: number;
  kafka_topic_id?: number;
  kafka_topic_name?: string;
  business_line_id?: string;
  business_line_name?: string;
  // 业务详情字段
  system_page?: string;
  module?: string;
  data_fields?: string[];
  error?: string;
}

interface KafkaTopic {
  id: number;
  topic_name: string;
  producer_group?: string;
  consumer_group?: string;
  messages_per_sec: number;
  lag: number;
  business_lines: string[];
}

interface BusinessLine {
  id: string;
  name: string;
  system_page?: string;
  module?: string;
  functions?: string[];
  data_fields?: string[];
  description?: string;
  status?: string;
}

const HostManager: React.FC = () => {
  const [hosts, setHosts] = useState<Host[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [topics, setTopics] = useState<KafkaTopic[]>([]);
  const [businessLines, setBusinessLines] = useState<BusinessLine[]>([]);

  const [selectedHost, setSelectedHost] = useState<Host | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const [hostFilter, setHostFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState<string>('');

  const [hostModalOpen, setHostModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [businessLineModalOpen, setBusinessLineModalOpen] = useState(false);
  const [topicListModalOpen, setTopicListModalOpen] = useState(false);
  const [topicModalOpen, setTopicModalOpen] = useState(false);
  const [editingHost, setEditingHost] = useState<Host | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingBusinessLine, setEditingBusinessLine] = useState<string | null>(null);
  const [editingTopic, setEditingTopic] = useState<KafkaTopic | null>(null);
  const [newTopicInput, setNewTopicInput] = useState('');

  const [hostForm] = Form.useForm();
  const [taskForm] = Form.useForm();
  const [businessLineForm] = Form.useForm();
  const [topicForm] = Form.useForm();

  // 加载数据
  const loadData = async () => {
    try {
      const [hostsRes, tasksRes, topicsRes, blRes] = await Promise.all([
        axios.get('/api/v1/hosts'),
        axios.get('/api/v1/tasks'),
        axios.get('/api/v1/topics'),
        axios.get('/api/v1/business-lines'),
      ]);
      setHosts(hostsRes.data);
      setTasks(tasksRes.data);
      setTopics(topicsRes.data);
      setBusinessLines(blRes.data);
    } catch (error) {
      console.error('加载数据失败:', error);
      message.error('加载数据失败');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 筛选物理机
  const filteredHosts = hosts.filter(h => {
    if (hostFilter !== 'all' && h.status !== hostFilter) return false;
    if (searchText && !h.ip.includes(searchText) && !h.hostname?.includes(searchText)) return false;
    return true;
  });

  // 获取选中物理机的任务
  const hostTasks = selectedHost ? tasks.filter(t => t.host_ip === selectedHost.ip) : [];

  // 物理机状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'green';
      case 'alert': return 'red';
      case 'offline': return 'default';
      default: return 'default';
    }
  };

  // 任务状态颜色
  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'processing';
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'pending': return 'default';
      default: return 'default';
    }
  };

  // 格式化时间
  const formatTime = (time: string) => {
    return new Date(time).toLocaleString('zh-CN');
  };

  // CRUD: 物理机
  const handleAddHost = () => {
    setEditingHost(null);
    hostForm.resetFields();
    setHostModalOpen(true);
  };

  const handleEditHost = (host: Host) => {
    setEditingHost(host);
    hostForm.setFieldsValue(host);
    setHostModalOpen(true);
  };

  const handleDeleteHost = async (ip: string) => {
    try {
      await axios.delete(`/api/v1/hosts/${ip}`);
      message.success('删除成功');
      loadData();
    } catch (error: any) {
      message.error(error.response?.data?.error || '删除失败');
    }
  };

  const handleSaveHost = async () => {
    try {
      const values = await hostForm.validateFields();
      if (editingHost) {
        await axios.put(`/api/v1/hosts/${editingHost.ip}`, values);
        message.success('更新成功');
      } else {
        await axios.post('/api/v1/hosts', values);
        message.success('添加成功');
      }
      setHostModalOpen(false);
      loadData();
    } catch (error: any) {
      message.error(error.response?.data?.error || '操作失败');
    }
  };

  // CRUD: 任务
  const handleAddTask = () => {
    setEditingTask(null);
    taskForm.resetFields();
    taskForm.setFieldsValue({ host_ip: selectedHost?.ip });
    setTaskModalOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    // 将 data_fields 数组转换为逗号分隔的字符串
    const taskWithDataFields = {
      ...task,
      data_fields: task.data_fields?.join(', ') || '',
    };
    taskForm.setFieldsValue(taskWithDataFields);
    setTaskModalOpen(true);
  };

  const handleDeleteTask = async (task_id: string) => {
    try {
      await axios.delete(`/api/v1/tasks/${task_id}`);
      message.success('删除成功');
      loadData();
    } catch (error: any) {
      message.error(error.response?.data?.error || '删除失败');
    }
  };

  const handleSaveTask = async () => {
    try {
      const values = await taskForm.validateFields();
      // 将 data_fields 从逗号分隔的字符串转换为数组
      if (values.data_fields && typeof values.data_fields === 'string') {
        values.data_fields = values.data_fields.split(',').map((s: string) => s.trim()).filter((s: string) => s);
      }
      if (editingTask) {
        await axios.put(`/api/v1/tasks/${editingTask.task_id}`, values);
        message.success('更新成功');
      } else {
        await axios.post('/api/v1/tasks', values);
        message.success('添加成功');
      }
      setTaskModalOpen(false);
      loadData();
    } catch (error: any) {
      message.error(error.response?.data?.error || '操作失败');
    }
  };

  // CRUD: 业务线
  const handleAddBusinessLine = () => {
    // 打开新增业务线弹窗，保持管理弹窗打开
    setEditingBusinessLine('');
    businessLineForm.resetFields();
  };

  const handleEditBusinessLine = (bl: string) => {
    // 打开编辑业务线弹窗，保持管理弹窗打开
    setEditingBusinessLine(bl);
    businessLineForm.setFieldsValue({ name: bl });
  };

  const handleDeleteBusinessLine = async (name: string) => {
    try {
      await axios.delete(`/api/v1/business-lines/${encodeURIComponent(name)}`);
      message.success('删除成功');
      loadData();
    } catch (error: any) {
      message.error(error.response?.data?.error || '删除失败');
    }
  };

  const handleSaveBusinessLine = async () => {
    try {
      const values = await businessLineForm.validateFields();
      if (editingBusinessLine) {
        await axios.put(`/api/v1/business-lines/${encodeURIComponent(editingBusinessLine)}`, values);
        message.success('更新成功');
      } else {
        await axios.post('/api/v1/business-lines', values);
        message.success('添加成功');
      }
      setEditingBusinessLine(null);
      loadData();
    } catch (error: any) {
      message.error(error.response?.data?.error || '操作失败');
    }
  };

  // CRUD: Topic
  const handleAddTopic = () => {
    setEditingTopic(null);
    topicForm.resetFields();
    setTopicModalOpen(true);
  };

  const handleEditTopic = (topic: KafkaTopic) => {
    setEditingTopic(topic);
    topicForm.setFieldsValue(topic);
    setTopicModalOpen(true);
  };

  const handleDeleteTopic = async (topicName: string) => {
    try {
      await axios.delete(`/api/v1/topics/${encodeURIComponent(topicName)}`);
      message.success('删除成功');
      loadData();
    } catch (error: any) {
      message.error(error.response?.data?.error || '删除失败');
    }
  };

  const handleSaveTopic = async () => {
    try {
      const values = await topicForm.validateFields();
      if (editingTopic) {
        await axios.put(`/api/v1/topics/${editingTopic.topic_name}`, values);
        message.success('更新成功');
      } else {
        await axios.post('/api/v1/topics', values);
        message.success('添加成功');
      }
      setTopicModalOpen(false);
      loadData();
    } catch (error: any) {
      message.error(error.response?.data?.error || '操作失败');
    }
  };

  // 物理机表格列
  const hostColumns = [
    {
      title: 'IP',
      dataIndex: 'ip',
      key: 'ip',
      width: 140,
      render: (ip: string) => (
        <a onClick={() => {
          const host = hosts.find(h => h.ip === ip);
          if (host) setSelectedHost(host);
        }}>{ip}</a>
      ),
    },
    {
      title: '主机名',
      dataIndex: 'hostname',
      key: 'hostname',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {status === 'online' ? '在线' : status === 'alert' ? '告警' : '离线'}
        </Tag>
      ),
    },
    {
      title: '任务数',
      dataIndex: 'task_count',
      key: 'task_count',
      width: 80,
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: Host) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditHost(record)} />
          <Popconfirm title="确定删除?" onConfirm={() => handleDeleteHost(record.ip)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 任务表格列
  const taskColumns = [
    {
      title: '任务名',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Task) => <a onClick={() => setSelectedTask(record)}>{name}</a>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Badge status={getTaskStatusColor(status)} text={
          status === 'running' ? '运行中' :
          status === 'completed' ? '已完成' :
          status === 'failed' ? '失败' : '等待中'
        } />
      ),
    },
    {
      title: 'Kafka Topic',
      key: 'kafka_topic',
      render: (_: any, record: Task) => <Tag>{record.kafka_topic_name || '-'}</Tag>,
    },
    {
      title: '业务线',
      key: 'business_line',
      render: (_: any, record: Task) => <Tag color="purple">{record.business_line_name || '-'}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Task) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditTask(record)} />
          <Popconfirm title="确定删除?" onConfirm={() => handleDeleteTask(record.task_id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 统计卡片
  const stats = {
    totalHosts: hosts.length,
    onlineHosts: hosts.filter(h => h.status === 'online').length,
    alertHosts: hosts.filter(h => h.status === 'alert').length,
    runningTasks: tasks.filter(t => t.status === 'running').length,
    failedTasks: tasks.filter(t => t.status === 'failed').length,
    businessLines: businessLines.length,
    topics: topics.length,
  };

  return (
    <div>
      {/* 顶部统计 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card hoverable>
            <Statistic title="物理机总数" value={stats.totalHosts} prefix={<DesktopOutlined />} />
          </Card>
        </Col>
        <Col span={4}>
          <Card hoverable>
            <Statistic title="在线" value={stats.onlineHosts} valueStyle={{ color: '#3f8600' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card hoverable>
            <Statistic title="告警" value={stats.alertHosts} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card hoverable>
            <Statistic title="业务线" value={stats.businessLines} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col span={4}>
          <Card hoverable>
            <Statistic title="Kafka Topic" value={stats.topics} valueStyle={{ color: '#722ed1' }} />
          </Card>
        </Col>
      </Row>

      {/* 筛选栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Input
            placeholder="搜索 IP/主机名"
            prefix={<SearchOutlined />}
            style={{ width: 200 }}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
          />
          <Select
            value={hostFilter}
            onChange={setHostFilter}
            style={{ width: 120 }}
          >
            <Option value="all">全部状态</Option>
            <Option value="online">在线</Option>
            <Option value="alert">告警</Option>
            <Option value="offline">离线</Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddHost}>新增物理机</Button>
          <Button onClick={() => setBusinessLineModalOpen(true)}>管理业务线</Button>
          <Button onClick={() => setTopicListModalOpen(true)}>管理 Kafka Topic</Button>
        </Space>
      </Card>

      {/* 物理机列表 */}
      <Card title="物理机列表">
        <Table
          columns={hostColumns}
          dataSource={filteredHosts}
          rowKey="ip"
          size="middle"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* 物理机任务弹窗 */}
      <Modal
        title={`任务列表 - ${selectedHost?.ip}`}
        open={!!selectedHost && !selectedTask}
        onCancel={() => setSelectedHost(null)}
        footer={[
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAddTask}>
            新增任务
          </Button>,
          <Button key="close" onClick={() => setSelectedHost(null)}>
            关闭
          </Button>,
        ]}
        width={900}
      >
        <Table
          columns={taskColumns}
          dataSource={hostTasks}
          rowKey="task_id"
          size="small"
          pagination={{ pageSize: 5 }}
        />
      </Modal>

      {/* 任务详情弹窗 */}
      <Modal
        title={`任务详情 - ${selectedTask?.name}`}
        open={!!selectedTask}
        onCancel={() => setSelectedTask(null)}
        footer={[
          <Button key="close" onClick={() => setSelectedTask(null)}>
            关闭
          </Button>,
        ]}
        width={600}
      >
        {selectedTask && (
          <div>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="任务ID">{selectedTask.task_id}</Descriptions.Item>
              <Descriptions.Item label="物理机IP">{selectedTask.host_ip}</Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 24 }}>
              <h4>业务流向</h4>
              <Steps
                direction="vertical"
                size="small"
                items={[
                  {
                    title: <span style={{ fontWeight: 500, color: '#333' }}>任务</span>,
                    icon: <PlayCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />,
                    description: (
                      <div style={{ border: '1px solid #e8e8e8', borderRadius: 6, padding: 12, background: '#fafafa' }}>
                        <div style={{ marginBottom: 6 }}>
                          <span style={{ color: '#888', fontSize: 12 }}>任务名称：</span>
                          <span style={{ fontWeight: 'bold' }}>{selectedTask.name}</span>
                        </div>
                        <div>
                          <span style={{ color: '#888', fontSize: 12 }}>物理机IP：</span>
                          <Tag color="green">{selectedTask.host_ip}</Tag>
                        </div>
                      </div>
                    ),
                    status: 'process',
                  },
                  {
                    title: <span style={{ fontWeight: 500, color: '#333' }}>Kafka</span>,
                    icon: <MessageOutlined style={{ color: '#1890ff', fontSize: 20 }} />,
                    description: (
                      <div style={{ border: '1px solid #e8e8e8', borderRadius: 6, padding: 12, background: '#fafafa' }}>
                        <div style={{ marginBottom: 6 }}>
                          <span style={{ color: '#888', fontSize: 12 }}>Topic：</span>
                          <Tag color="blue">{selectedTask.kafka_topic_name}</Tag>
                        </div>
                        <div style={{ marginBottom: 6 }}>
                          <span style={{ color: '#888', fontSize: 12 }}>生产者组：</span>
                          <span>{topics.find(t => t.id === selectedTask.kafka_topic_id)?.producer_group || '-'}</span>
                        </div>
                        <div>
                          <span style={{ color: '#888', fontSize: 12 }}>消费者组：</span>
                          <span>{topics.find(t => t.id === selectedTask.kafka_topic_id)?.consumer_group || '-'}</span>
                        </div>
                      </div>
                    ),
                    status: 'wait',
                  },
                  {
                    title: <span style={{ fontWeight: 500, color: '#333' }}>业务</span>,
                    icon: <ShopOutlined style={{ color: '#722ed1', fontSize: 20 }} />,
                    description: (() => {
                      const bl = businessLines.find(b => b.id === selectedTask.business_line_id);
                      return (
                        <div style={{ border: '1px solid #e8e8e8', borderRadius: 6, padding: 12, background: '#fafafa' }}>
                          <div style={{ marginBottom: 6 }}>
                            <span style={{ color: '#888', fontSize: 12 }}>业务线：</span>
                            <Tag color="purple">{bl?.name || selectedTask.business_line_name}</Tag>
                          </div>
                          {(bl?.system_page || selectedTask.system_page) && (
                            <div style={{ marginBottom: 6 }}>
                              <span style={{ color: '#888', fontSize: 12 }}>系统页面：</span>
                              <Tag color="blue">{bl?.system_page || selectedTask.system_page}</Tag>
                            </div>
                          )}
                          {(bl?.module || selectedTask.module) && (
                            <div>
                              <span style={{ color: '#888', fontSize: 12 }}>功能模块：</span>
                              <Tag color="cyan">{bl?.module || selectedTask.module}</Tag>
                            </div>
                          )}
                        </div>
                      );
                    })(),
                    status: 'wait',
                  },
                  {
                    title: <span style={{ fontWeight: 500, color: '#333' }}>数据</span>,
                    icon: <DatabaseOutlined style={{ color: '#fa541c', fontSize: 20 }} />,
                    description: (
                      <div style={{ border: '1px solid #e8e8e8', borderRadius: 6, padding: 12, background: '#fafafa' }}>
                        <span style={{ color: '#888', fontSize: 12 }}>数据字段：</span>
                        {selectedTask.data_fields?.length ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                            {selectedTask.data_fields.map(f => <Tag key={f} color="orange">{f}</Tag>)}
                          </div>
                        ) : <span style={{ color: '#888' }}>-</span>}
                      </div>
                    ),
                    status: 'wait',
                  },
                ]}
              />
            </div>

            {/* 业务详情 */}
            {(selectedTask.system_page || selectedTask.module || selectedTask.data_fields?.length) && (
              <div style={{ marginTop: 24 }}>
                <h4>业务详情</h4>
                <Descriptions bordered column={2} size="small">
                  <Descriptions.Item label="系统页面">{selectedTask.system_page || '-'}</Descriptions.Item>
                  <Descriptions.Item label="功能模块">{selectedTask.module || '-'}</Descriptions.Item>
                  <Descriptions.Item label="数据字段" span={2}>
                    {selectedTask.data_fields?.length ? selectedTask.data_fields.map(f => <Tag key={f} color="orange">{f}</Tag>) : '-'}
                  </Descriptions.Item>
                </Descriptions>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* 物理机编辑弹窗 */}
      <Modal
        title={editingHost ? '编辑物理机' : '新增物理机'}
        open={hostModalOpen}
        onOk={handleSaveHost}
        onCancel={() => setHostModalOpen(false)}
      >
        <Form form={hostForm} layout="vertical">
          <Form.Item name="ip" label="IP 地址" rules={[{ required: true, message: '请输入 IP 地址' }]}>
            <Input placeholder="192.168.1.100" disabled={!!editingHost} />
          </Form.Item>
          <Form.Item name="hostname" label="主机名">
            <Input placeholder="crawler-node-01" />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="offline">
            <Select>
              <Option value="online">在线</Option>
              <Option value="offline">离线</Option>
              <Option value="alert">告警</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 任务编辑弹窗 */}
      <Modal
        title={editingTask ? '编辑任务' : '新增任务'}
        open={taskModalOpen}
        onOk={handleSaveTask}
        onCancel={() => setTaskModalOpen(false)}
      >
        <Form form={taskForm} layout="vertical">
          <Form.Item name="name" label="任务名称" rules={[{ required: true, message: '请输入任务名称' }]}>
            <Input placeholder="京东商品爬取" />
          </Form.Item>
          <Form.Item name="host_ip" label="物理机IP" rules={[{ required: true, message: '请选择物理机' }]}>
            <Select placeholder="选择物理机">
              {hosts.map(h => <Option key={h.ip} value={h.ip}>{h.ip} - {h.hostname}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="pending">
            <Select>
              <Option value="pending">等待中</Option>
              <Option value="running">运行中</Option>
              <Option value="completed">已完成</Option>
              <Option value="failed">失败</Option>
            </Select>
          </Form.Item>
          <Form.Item name="kafka_topic_id" label="Kafka Topic" rules={[{ required: true, message: '请选择 Topic' }]}>
            <Select
              placeholder="选择 Topic"
              showSearch
              allowClear
            >
              {topics.map(t => <Option key={t.id} value={t.id}>{t.topic_name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="business_line_id" label="业务线" rules={[{ required: true, message: '请选择业务线' }]}>
            <Select placeholder="选择业务线">
              {businessLines.map(bl => <Option key={bl.id} value={bl.id}>{bl.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="system_page" label="系统页面">
            <Input placeholder="/products" />
          </Form.Item>
          <Form.Item name="module" label="功能模块">
            <Input placeholder="crawler" />
          </Form.Item>
          <Form.Item name="data_fields" label="数据字段">
            <Input placeholder="输入多个值，用逗号分隔，如: sku,price,stock" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 业务线管理弹窗 */}
      <Modal
        title="业务线管理"
        open={businessLineModalOpen}
        onCancel={() => setBusinessLineModalOpen(false)}
        footer={[
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAddBusinessLine}>
            新增业务线
          </Button>,
          <Button key="close" onClick={() => setBusinessLineModalOpen(false)}>
            关闭
          </Button>,
        ]}
      >
        <List
          size="small"
          dataSource={businessLines}
          renderItem={(item: BusinessLine) => (
            <List.Item
              actions={[
                <Button key="edit" type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditBusinessLine(item.name)} />,
                <Popconfirm key="delete" title="确定删除?" onConfirm={() => handleDeleteBusinessLine(item.name)}>
                  <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              ]}
            >
              <Tag color="purple" style={{ fontSize: 14, padding: '4px 12px' }}>{item.name}</Tag>
            </List.Item>
          )}
        />
      </Modal>

      {/* 业务线编辑弹窗 */}
      <Modal
        title={editingBusinessLine ? '编辑业务线' : '新增业务线'}
        open={editingBusinessLine !== null}
        onOk={handleSaveBusinessLine}
        onCancel={() => setEditingBusinessLine(null)}
      >
        <Form form={businessLineForm} layout="vertical">
          <Form.Item name="name" label="业务线名称" rules={[{ required: true, message: '请输入业务线名称' }]}>
            <Input placeholder="电商平台" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Kafka Topic 管理弹窗 */}
      <Modal
        title="Kafka Topic 管理"
        open={topicListModalOpen}
        onCancel={() => setTopicListModalOpen(false)}
        footer={[
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAddTopic}>
            新增 Topic
          </Button>,
          <Button key="close" onClick={() => setTopicListModalOpen(false)}>
            关闭
          </Button>,
        ]}
        width={700}
      >
        <Table
          size="small"
          dataSource={topics}
          rowKey="id"
          pagination={false}
          columns={[
            {
              title: 'Topic',
              dataIndex: 'topic_name',
              key: 'topic_name',
              render: (text: string) => <Tag color="blue">{text}</Tag>,
            },
            {
              title: '生产者组',
              dataIndex: 'producer_group',
              key: 'producer_group',
              render: (text: string) => text || '-',
            },
            {
              title: '消费者组',
              dataIndex: 'consumer_group',
              key: 'consumer_group',
              render: (text: string) => text || '-',
            },
            {
              title: '操作',
              key: 'action',
              width: 100,
              render: (_: any, record: KafkaTopic) => (
                <Space>
                  <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditTopic(record)} />
                  <Popconfirm title="确定删除?" onConfirm={() => handleDeleteTopic(record.topic_name)}>
                    <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Modal>

      {/* Topic 编辑弹窗 */}
      <Modal
        title={editingTopic ? '编辑 Topic' : '新增 Topic'}
        open={topicModalOpen}
        onOk={handleSaveTopic}
        onCancel={() => setTopicModalOpen(false)}
      >
        <Form form={topicForm} layout="vertical">
          <Form.Item name="topic_name" label="Topic 名称" rules={[{ required: true, message: '请输入 Topic 名称' }]}>
            <Input placeholder="product-updates" disabled={!!editingTopic} />
          </Form.Item>
          <Form.Item name="producer_group" label="生产者组">
            <Input placeholder="crawler-group" />
          </Form.Item>
          <Form.Item name="consumer_group" label="消费者组">
            <Input placeholder="consumer-group" />
          </Form.Item>
        </Form>
      </Modal>

      <style>{`
        .ant-table-row-selected {
          background-color: #e6f7ff !important;
        }
      `}</style>
    </div>
  );
};

export default HostManager;