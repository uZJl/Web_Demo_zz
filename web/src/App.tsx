import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import { DashboardOutlined, PlayCircleOutlined, VideoCameraOutlined, FileOutlined, DesktopOutlined } from '@ant-design/icons';
import Dashboard from './pages/Dashboard';
import Executor from './pages/Executor';
import Recorder from './pages/Recorder';
import Reports from './pages/Reports';
import HostManager from './pages/HostManager';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/execute', icon: <PlayCircleOutlined />, label: '执行测试' },
  { key: '/record', icon: <VideoCameraOutlined />, label: '录制脚本' },
  { key: '/reports', icon: <FileOutlined />, label: '测试报告' },
  { key: '/hosts', icon: <DesktopOutlined />, label: '物理机管理' },
];

function App() {
  const navigate = useNavigate();

  const handleMenuClick = (key: string) => {
    navigate(key);
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', padding: '0 24px', display: 'flex', alignItems: 'center' }}>
        <div style={{ color: '#fff', fontSize: '20px', fontWeight: 'bold' }}>
          Testergizer
        </div>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: '#fff' }}>
          <Menu
            mode="inline"
            defaultSelectedKeys={['/']}
            items={menuItems}
            onClick={({ key }) => handleMenuClick(key)}
            style={{ height: '100%', borderRight: 0 }}
          />
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <Content
            style={{
              background: '#fff',
              padding: 24,
              margin: 0,
              minHeight: 280,
            }}
          >
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/execute" element={<Executor />} />
              <Route path="/record" element={<Recorder />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/hosts" element={<HostManager />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}

export default App;
