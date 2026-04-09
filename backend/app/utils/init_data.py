"""初始化示例数据"""
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import random

from app.models.host import Host
from app.models.task import Task
from app.models.alert import Alert
from app.models.business_line import BusinessLine
from app.models.kafka_topic import KafkaTopic
from app.database import Base


def init_sample_data(database_url: str = "sqlite:///./testergizer.db"):
    """初始化示例数据"""
    # 创建同步引擎
    engine = create_engine(
        database_url.replace("+aiosqlite", ""),
        connect_args={"check_same_thread": False}
    )

    # 创建表
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        # 检查是否已有数据
        existing_hosts = session.query(Host).count()
        if existing_hosts > 0:
            print("Data already exists, skipping initialization")
            return

        # 创建物理机
        hosts = [
            Host(ip="192.168.1.10", hostname="crawler-01", status="online",
                 task_count=5, last_active_at=datetime.utcnow() - timedelta(minutes=5),
                 tags=["crawler", "product"]),
            Host(ip="192.168.1.11", hostname="crawler-02", status="online",
                 task_count=3, last_active_at=datetime.utcnow() - timedelta(minutes=2),
                 tags=["crawler", "inventory"]),
            Host(ip="192.168.1.12", hostname="crawler-03", status="alert",
                 task_count=8, last_active_at=datetime.utcnow() - timedelta(hours=1),
                 tags=["crawler", "pricing"]),
            Host(ip="192.168.1.13", hostname="crawler-04", status="offline",
                 task_count=0, last_active_at=datetime.utcnow() - timedelta(days=1),
                 tags=["crawler", "review"]),
        ]
        session.add_all(hosts)

        # 创建业务线
        business_lines = [
            BusinessLine(id="bl-1", name="产品数据采集", system_page="/products",
                        module="crawler", functions=["爬取", "解析", "存储"],
                        data_fields=["sku", "price", "stock"], status="active"),
            BusinessLine(id="bl-2", name="库存监控", system_page="/inventory",
                        module="monitor", functions=["监控", "告警"],
                        data_fields=["quantity", "threshold"], status="active"),
            BusinessLine(id="bl-3", name="价格追踪", system_page="/pricing",
                        module="tracker", functions=["追踪", "比价"],
                        data_fields=["price", "competitor"], status="active"),
            BusinessLine(id="bl-4", name="评论分析", system_page="/reviews",
                        module="analytics", functions=["采集", "分析"],
                        data_fields=["sentiment", "rating"], status="active"),
        ]
        session.add_all(business_lines)

        # 创建 Kafka Topics
        topics = [
            KafkaTopic(topic_name="product-updates", consumer_group="crawler-group-1",
                      messages_per_sec=120, lag=500, business_lines=["产品数据采集"]),
            KafkaTopic(topic_name="inventory-alerts", consumer_group="monitor-group",
                      messages_per_sec=45, lag=100, business_lines=["库存监控"]),
            KafkaTopic(topic_name="price-changes", consumer_group="tracker-group",
                      messages_per_sec=80, lag=200, business_lines=["价格追踪"]),
            KafkaTopic(topic_name="review-data", consumer_group="analytics-group",
                      messages_per_sec=30, lag=50, business_lines=["评论分析"]),
        ]
        session.add_all(topics)

        # 创建任务
        tasks = []
        task_names = [
            ("爬取天猫商品", "product-updates", "产品数据采集"),
            ("监控库存变化", "inventory-alerts", "库存监控"),
            ("追踪价格波动", "price-changes", "价格追踪"),
            ("分析评论情感", "review-data", "评论分析"),
            ("同步商品信息", "product-updates", "产品数据采集"),
            ("检查缺货商品", "inventory-alerts", "库存监控"),
            ("竞品价格对比", "price-changes", "价格追踪"),
        ]

        statuses = ["running", "completed", "failed", "pending"]
        for i, (name, topic, bl) in enumerate(task_names):
            host = random.choice(hosts)
            status = random.choice(statuses)
            started = datetime.utcnow() - timedelta(minutes=random.randint(10, 120))
            duration = random.randint(1000, 300000) if status != "running" else None

            task = Task(
                task_id=f"task-{i+1:03d}",
                name=name,
                host_ip=host.ip,
                status=status,
                started_at=started,
                completed_at=started + timedelta(milliseconds=duration) if duration else None,
                duration=duration,
                kafka_topic=topic,
                business_line=bl,
                error="Connection timeout" if status == "failed" else None
            )
            tasks.append(task)
        session.add_all(tasks)

        # 创建告警
        alerts = [
            Alert(id="alert-1", host_ip="192.168.1.12", type="cpu",
                 level="critical", message="CPU 使用率 95%"),
            Alert(id="alert-2", host_ip="192.168.1.12", type="memory",
                 level="warning", message="内存使用率 85%"),
            Alert(id="alert-3", host_ip="192.168.1.10", type="network",
                 level="warning", message="网络延迟过高"),
        ]
        session.add_all(alerts)

        session.commit()
        print("Sample data initialized successfully!")


if __name__ == "__main__":
    init_sample_data()