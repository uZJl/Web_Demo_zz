import { Card, Row, Col, Statistic } from 'antd';

export default function Dashboard() {
  return (
    <div>
      <h1>仪表盘</h1>
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic title="总测试数" value={0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="通过" value={0} valueStyle={{ color: '#3f8600' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="失败" value={0} valueStyle={{ color: '#cf1322' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="执行中" value={0} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
