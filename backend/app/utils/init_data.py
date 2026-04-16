"""初始化示例数据"""
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import random

from app.models.host import Host
from app.models.task import Task
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
                 task_count=5, last_active_at=datetime.utcnow() - timedelta(minutes=5)),
            Host(ip="192.168.1.11", hostname="crawler-02", status="online",
                 task_count=3, last_active_at=datetime.utcnow() - timedelta(minutes=2)),
            Host(ip="192.168.1.12", hostname="crawler-03", status="alert",
                 task_count=8, last_active_at=datetime.utcnow() - timedelta(hours=1)),
            Host(ip="192.168.1.13", hostname="crawler-04", status="offline",
                 task_count=0, last_active_at=datetime.utcnow() - timedelta(days=1)),
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

        # 创建任务 - 使用 ID 关联
        tasks = [
            Task(task_id="task-001", name="爬取天猫商品", host_ip="192.168.1.10", status="completed",
                 started_at=datetime.utcnow() - timedelta(hours=2), completed_at=datetime.utcnow() - timedelta(hours=1, minutes=50),
                 duration=600000, kafka_topic_id=1, business_line_id="bl-1"),
            Task(task_id="task-002", name="监控库存变化", host_ip="192.168.1.11", status="running",
                 started_at=datetime.utcnow() - timedelta(minutes=30), kafka_topic_id=2, business_line_id="bl-2"),
            Task(task_id="task-003", name="追踪价格波动", host_ip="192.168.1.10", status="failed",
                 started_at=datetime.utcnow() - timedelta(hours=3), completed_at=datetime.utcnow() - timedelta(hours=2, minutes=59),
                 duration=60000, kafka_topic_id=3, business_line_id="bl-3", error="Connection timeout"),
            Task(task_id="task-004", name="分析评论情感", host_ip="192.168.1.12", status="completed",
                 started_at=datetime.utcnow() - timedelta(hours=5), completed_at=datetime.utcnow() - timedelta(hours=4, minutes=30),
                 duration=1800000, kafka_topic_id=4, business_line_id="bl-4"),
            Task(task_id="task-005", name="同步商品信息", host_ip="192.168.1.11", status="pending",
                 kafka_topic_id=1, business_line_id="bl-1"),
        ]
        session.add_all(tasks)

        session.commit()
        print("Sample data initialized successfully!")


if __name__ == "__main__":
    init_sample_data()