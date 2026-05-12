---
title: 分布式MOM作业
date: 2024-05-10 17:07:10
tags:
- 代码
- 分布式
categories:
- [代码,数学建模]
---
分布式作业
<!--more-->
# 问题重述
![](homework.png) 

# 实验原理
这段代码涉及到Java消息服务（JMS）和消息代理（Apache ActiveMQ），它们是用于构建分布式、可靠和异步消息传递系统的关键技术。

**JMS** 是 Java 中用于发送和接收消息的 API 规范，它提供了一种标准的方式来创建、发送、接收和管理消息。JMS 有两种消息传递模型：点对点（Point-to-Point）和发布/订阅（Publish/Subscribe）。在这个例子中，我们使用的是发布/订阅模型。

**消息代理** 是一个中间件系统，负责将消息从发送者传递给接收者。Apache ActiveMQ 是一个流行的开源消息代理，它实现了 JMS 规范，并提供了可靠的消息传递机制。在这个例子中，ActiveMQ 充当了消息代理的角色，负责管理消息的传递和路由。

# 开发环境
## 软件版本
Windows11  
Eclipse IDE for Java Developers - 2022-03
Java 1.8
Active MQ 6.1.0
Xchart 3.8.1
Maven3.6.1

![](evm.png)

## pom文件配置

```
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <properties>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
        <maven.compiler.encoding>UTF-8</maven.compiler.encoding>
        <java.version>21</java.version>
        <maven.compiler.source>21</maven.compiler.source>
        <maven.compiler.target>21</maven.compiler.target>
    </properties>

    <groupId>com.xidian.dc.mq</groupId>
    <artifactId>mq-topic</artifactId>
    <version>1.0-SNAPSHOT</version>
    
    <dependencies>     
        <!-- https://mvnrepository.com/artifact/org.apache.activemq/activemq-all -->
        <dependency>
	        <groupId>org.knowm.xchart</groupId>
	        <artifactId>xchart</artifactId>
	        <version>3.8.1</version>
        </dependency>
        <dependency>
            <groupId>org.jfree</groupId>
            <artifactId>jfreechart</artifactId>
            <version>1.5.3</version>
        </dependency>
        <dependency>
            <groupId>jakarta.jms</groupId>
            <artifactId>jakarta.jms-api</artifactId>
            <version>3.1.0</version>
        </dependency>
		<dependency>
			<groupId>org.apache.activemq</groupId>
			<artifactId>activemq-all</artifactId>
			<version>6.1.0</version>
		</dependency>
        <dependency>
            <groupId>org.apache.logging.log4j</groupId>
            <artifactId>log4j-api</artifactId>
            <version>2.17.2</version>
        </dependency>
        <dependency>
            <groupId>org.apache.logging.log4j</groupId>
            <artifactId>log4j-core</artifactId>
            <version>2.17.2</version>
        </dependency>
    </dependencies>

    
</project>

```

# 设计思路
## 构架图

![](stream.jpg)

## 各个代码的用途

### Publisher
随机信号产生器微服务，生成正太分布的随机数字并发布在MYTOPIC服务上
生成方式'double randomNumner = random.nextGaussian() * stdDev + mean ; '
通过传输main函数的变量来区分不同的产生器
### ASyncConsumer
随机信号统计分析微服务，并将处理后的数据发布在DATA服务上
storeMessage:对传输过来的数据进行处理并存储
publisher:对存储的数据进行统计和发布
### MyListener
实现MessageListener接口，并接收存储数据。实现对ASyncConsumer的consumer的处理
### ShowConsumer
实时数据显示微服务，并调用RealTimeChart实现数据的可视化
paint:通过调用RealTimeChart里面的plot来实现实时绘制图像
### MyListener1
实现MessageListener接口，并接收存储数据。实现对ShowConsumer的consumer的处理
### RealTimeChart
实现实时画图

# Commands
mvn clean
mvn compile

mvn exec:java -Dexec.mainClass="ASyncConsumer"

mvn exec:java -Dexec.mainClass="ShowConsumer"

mvn exec:java -Dexec.mainClass="Publisher" -Dexec.args="1"
mvn exec:java -Dexec.mainClass="Publisher" -Dexec.args="2"
mvn exec:java -Dexec.mainClass="Publisher" -Dexec.args="3"
mvn exec:java -Dexec.mainClass="Publisher" -Dexec.args="4"

# JAVA程序
## MyListener.java
```java


import jakarta.jms.Message;
import jakarta.jms.MessageListener;
import jakarta.jms.ObjectMessage;
import jakarta.jms.Message;
import jakarta.jms.TextMessage;

public class MyListener implements MessageListener {
	
	private ASyncConsumer consumer ; 
	
	public MyListener ( ASyncConsumer consumer ) {
		this.consumer = consumer ; 
	}

	public void onMessage(Message message) {
		try {
			String text = ((TextMessage) message).getText() ; 
			System.out.println("Received a message: "+text);
			consumer.storeMessage(text);
			consumer.publisher("ACK");
		} catch (Exception e) {
			e.printStackTrace();
		}
	}

}

```
## Publisher.java
```java
import jakarta.jms.Connection;
import java.util.Random ; 
import jakarta.jms.ConnectionFactory;
import jakarta.jms.Destination;
import jakarta.jms.JMSException;
import jakarta.jms.Message;
import jakarta.jms.MessageProducer;
import jakarta.jms.ObjectMessage;
import jakarta.jms.Session;
import jakarta.jms.Topic;

import org.apache.activemq.ActiveMQConnectionFactory;

public class Publisher {

    private static String brokerURL = "tcp://localhost:61616";
    private static ConnectionFactory factory;
    private Connection connection;
    private Session session;
    private MessageProducer producer;
	private Topic topic;
    
    public Publisher(String topicName) throws JMSException {
		
    	factory = new ActiveMQConnectionFactory(brokerURL);
    	connection = factory.createConnection();
        
        session = connection.createSession(false, Session.AUTO_ACKNOWLEDGE);
		topic = session.createTopic(topicName);
        producer = session.createProducer(topic);
		
		connection.start();
    }    
    
    public void close() throws JMSException {
        if (connection != null) {
            connection.close();
        }
    }    
    
	public static void main(String[] args) throws JMSException {
    	Publisher publisher = new Publisher("MYTOPIC");
    	System.out.println(args[0]) ; 
    	while ( true ) {
    		publisher.sendMessage(args[0]);
        	try {
				Thread.sleep(1000);
			} catch (InterruptedException e) {
				// TODO Auto-generated catch block
				publisher.close();
				e.printStackTrace();
			}
    	}
	}
	
    public void sendMessage(String UID ) throws JMSException {
        Random random = new Random( ) ;
    	int num = Integer.parseInt(UID) ;
        double mean = num ; 
        double stdDev = 1 ; 
        double randomNumner = random.nextGaussian() * stdDev + mean ; 
        Message message = session.createTextMessage(UID+"+"+Double.toString(randomNumner));
		//for(int i=0;i<15;i++){
		producer.send(message);
		System.out.println("Sent a message!");
		//}
    }	
    
    public void sendData ( String Data ) throws JMSException {
    	Message message = session.createTextMessage(Data) ; 
    	producer.send(message);
    	System.out.println ("Sent a Data!") ; 
    }

}
```

## ASyncConsumer.java

```java

import jakarta.jms.Connection;
import jakarta.jms.ConnectionFactory;
import jakarta.jms.Destination;
import jakarta.jms.JMSException;
import jakarta.jms.MessageConsumer;
import jakarta.jms.MessageProducer;
import jakarta.jms.Session;
import jakarta.jms.Message;
import jakarta.jms.TextMessage;
import jakarta.jms.Topic;
import java.util.ArrayList ; 
import java.util.List; 

import org.apache.activemq.ActiveMQConnectionFactory;

public class ASyncConsumer {
	
	private List<String> messages ; 
	private List<Double>[] arrayOfLists = new List[5] ;  
	
	public ASyncConsumer ( ) {
		messages = new ArrayList<>() ; 
		for ( int i = 0 ; i < arrayOfLists.length ; i ++ ) {
			arrayOfLists[i] = new ArrayList<>() ; 
		}
	}
	
	public void storeMessage ( String message ) { 
		messages.add(message) ; 
		String[] parts = message.split("\\+") ; 
		String intPart = parts[0] ; 
		String doublePart = parts[1] ; 
		int uid = Integer.parseInt(intPart) ; 
		double val = Double.parseDouble(doublePart) ; 
		arrayOfLists[uid].add(val) ; 
	}
	
	public List<String> getMessages ( ) {
		return messages ; 
	}
	
	public void printMessages ( ) {
		System.out.println("Messages:") ; 
		for ( String message : messages ) {
			System.out.print ( "orz" + message ) ; 
		}
	}
	
    public static double calculateMean(List<Double> data) {
        double sum = 0;
        for (double value : data) {
            sum += value;
        }
        if ( data.size() == 0 ) return 0 ; 
        return sum / data.size();
    }

    public static double calculateVariance(List<Double> data, double mean) {
        double sumSquaredDiff = 0;
        for (double value : data) {
            sumSquaredDiff += Math.pow(value - mean, 2);
        }
        if ( data.size() == 0 ) return 0 ; 
        return sumSquaredDiff / data.size();
    }
	
	public void publisher ( String topicname ) throws JMSException {
		Publisher publisher = new Publisher("DATA");
		int n = 5 ; 
		for ( int i = 0 ; i < 5 ; i ++ ) {
			double mean = calculateMean (arrayOfLists[i].subList(Math.max(arrayOfLists[i].size()-n, 0),arrayOfLists[i].size())) ; 
			double variance = calculateVariance (arrayOfLists[i].subList(Math.max(arrayOfLists[i].size()-n, 0),arrayOfLists[i].size()),mean) ; 
			double Max = arrayOfLists[i].stream().mapToDouble(Double::doubleValue).max().orElse(0) ; 
			double Min = arrayOfLists[i].stream().mapToDouble(Double::doubleValue).min().orElse(0) ;
			//if ( Max == Double.NaN ) Max = 0 ; 
			//if ( Min == Double.NaN ) Min = 0 ; 
			double cur = 0 ; 
			if ( arrayOfLists[i].size() != 0 )
				cur = arrayOfLists[i].get(arrayOfLists[i].size()-1) ; 
			else 
				cur = 0 ; 
			String Data = Integer.toString(i)+"+"+Double.toString(mean)+"+"+Double.toString(variance)+"+"+Double.toString(Max)+"+"+Double.toString(Min)+"+"+Double.toString(cur); 
			publisher.sendData(Data);
		}
	}

    public static void main(String[] args) throws JMSException {
    	ASyncConsumer consumer = new ASyncConsumer ( ) ; 
    	
		String brokerURL = "tcp://localhost:61616";
		ConnectionFactory factory = null;
		Connection connection = null;
		Session session = null;
		Topic topic = null;
		MessageConsumer messageConsumer = null;
		MyListener listener = null;
		
        
		try {
			factory = new ActiveMQConnectionFactory(brokerURL);
			connection = factory.createConnection();
						
			session = connection.createSession(false, Session.AUTO_ACKNOWLEDGE);
			topic = session.createTopic("MYTOPIC");

			messageConsumer = session.createConsumer(topic);
			
			listener = new MyListener(consumer);
			
			messageConsumer.setMessageListener(listener);
			
			connection.start();
			
			//consumer.printMessages();
			
			System.out.println("Press any key to exit.");
			System.in.read();   // Pause
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			connection.close();
		}
	}
	
}

```

## ShowConsumer

```java

import jakarta.jms.Connection;
import jakarta.jms.ConnectionFactory;
import jakarta.jms.Destination;
import jakarta.jms.JMSException;
import jakarta.jms.MessageConsumer;
import jakarta.jms.MessageProducer;
import jakarta.jms.Session;
import jakarta.jms.Message;
import jakarta.jms.TextMessage;
import jakarta.jms.Topic;
import java.util.ArrayList ; 
import java.util.List; 

import org.apache.activemq.ActiveMQConnectionFactory;

public class ShowConsumer {
	private List<Double>[][] arrayOfLists = new List[6][5] ; 
	RealTimeChart[] chart = new RealTimeChart[6] ; 
	// 数组1，2，3，4,5分别代表均值，方差，最大值，最小值,目前值
	public ShowConsumer ( ) {
		for ( int i = 1 ; i < 6 ; i ++ ) {
			for ( int j = 0 ; j < 5 ; j ++ ) {
				arrayOfLists[i][j] = new ArrayList<>() ; 
			}
		}
		for ( int i = 1 ; i < 6 ; i ++ ) {
			chart[i] = new RealTimeChart ( "History Data" , "UID"+Integer.toString(i) , 500 ) ; 
		}
	}

	
	public void paint ( ) {
		for ( int i = 1 ; i < 6 ; i ++ ) {
			if ( arrayOfLists[i][4].size() != 0 )
				chart[i].plot(arrayOfLists[i][4].get(arrayOfLists[i][4].size()-1));
		}
	}
	
	public void storeMessage ( String message ) { 
		String[] parts = message.split("\\+") ; 
		String uidPart = parts[0] ; 
		String meanPart = parts[1] ; 
		String variancePart = parts[2] ; 
		String maxPart = parts[3] ; 
		String minPart = parts[4] ; 
		String curPart = parts[5] ; 
		int uid = Integer.parseInt(uidPart) ; 
		double mean = Double.parseDouble(meanPart) ; 
		double variance = Double.parseDouble(variancePart) ;
		double Max = Double.parseDouble(maxPart) ; 
		double Min = Double.parseDouble(minPart) ; 
		double cur = Double.parseDouble(curPart) ; 
		arrayOfLists[uid][0].add(mean) ; 
		arrayOfLists[uid][1].add(variance) ;
		arrayOfLists[uid][2].add(Max) ;
		arrayOfLists[uid][3].add(Min) ;
		arrayOfLists[uid][4].add(cur) ; 
	}
	public static void main(String[] args) throws JMSException {
    	ShowConsumer consumer = new ShowConsumer ( ) ; 
    	
		String brokerURL = "tcp://localhost:61616";
		ConnectionFactory factory = null;
		Connection connection = null;
		Session session = null;
		Topic topic = null;
		MessageConsumer messageConsumer = null;
		MyListener2 listener = null;
		
        
		try {
			factory = new ActiveMQConnectionFactory(brokerURL);
			connection = factory.createConnection();
						
			session = connection.createSession(false, Session.AUTO_ACKNOWLEDGE);
			topic = session.createTopic("DATA");

			messageConsumer = session.createConsumer(topic);
			
			listener = new MyListener2(consumer);
			
			messageConsumer.setMessageListener(listener);
			
			connection.start();
			
			//consumer.printMessages();
			
			System.out.println("Press any key to exit.");
			System.in.read();   // Pause
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			connection.close();
		}
	}
}
```

## MyListener2.java

```java

import jakarta.jms.Message;
import jakarta.jms.MessageListener;
import jakarta.jms.ObjectMessage;
import jakarta.jms.Message;
import jakarta.jms.TextMessage;

public class MyListener2 implements MessageListener {
	
	private ShowConsumer consumer ; 
	
	public MyListener2 ( ShowConsumer consumer ) {
		this.consumer = consumer ; 
	}

	public void onMessage(Message message) {
		try {
			String text = ((TextMessage) message).getText() ; 
			System.out.println("Received a message2: "+text);
			consumer.storeMessage(text);
			consumer.paint ( ) ; 
			//consumer.publisher("ACK");
		} catch (Exception e) {
			e.printStackTrace();
		}
	}

}
```

## RealTimeChart.java

```java

import java.util.LinkedList;
import java.util.List;

import javax.swing.JFrame;

import org.knowm.xchart.SwingWrapper;
import org.knowm.xchart.XYChart;
import org.knowm.xchart.XYChartBuilder;
import org.knowm.xchart.style.Styler.ChartTheme;
import org.knowm.xchart.style.Styler.LegendLayout;
import org.knowm.xchart.style.Styler.LegendPosition;

public class RealTimeChart {
	private SwingWrapper<XYChart> swingWrapper ; 
	private XYChart chart ; 
	private JFrame frame ; 
	
	private String title ; 
	private String seriesName ; 
	private List<Double> seriesData ; 
	private int size = 1000 ; 
	
	public int getSize ( ) {
		return size ; 
	}
	
	public String getSeriesName ( ) {
		return seriesName ; 
	}
	
	public void setSeeriesName ( String seriesName ) {
		this.seriesName = seriesName ; 
	}
	
	public String getTitle ( ) {
		return title ; 
	}
	
	public void setTitle ( String title ) {
		this.title = title ; 
	}
	
	public RealTimeChart ( String title , String seriesName ) {
		super ( ) ; 
		this.seriesName = seriesName ; 
		this.title = title ; 
	}
	
	public RealTimeChart ( String title , String seriesName , int size ) {
		super ( ) ; 
		this.seriesName = seriesName ; 
		this.title = title ;
		this.size = size ; 
	}
	
	public void plot ( double data ) {
		if ( seriesData == null ) {
			seriesData = new LinkedList<>() ; 
		}
		if ( seriesData.size( ) == this.size ) {
			seriesData.clear ( ) ; 
		}
		seriesData.add(data) ; 
		
		if ( swingWrapper == null ) {
			chart = new XYChartBuilder().width(600).height(450).theme(ChartTheme.Matlab).title(title).build();
			chart.addSeries(seriesName, null, seriesData);
			chart.getStyler().setLegendPosition(LegendPosition.OutsideS);// 设置legend的位置为外底部
			chart.getStyler().setLegendLayout(LegendLayout.Horizontal);// 设置legend的排列方式为水平排列
 
			swingWrapper = new SwingWrapper<XYChart>(chart);
			frame = swingWrapper.displayChart();
			frame.setDefaultCloseOperation(JFrame.DISPOSE_ON_CLOSE);// 防止关闭窗口时退出
		}
		else { 
			chart.updateXYSeries ( seriesName , null , seriesData , null ) ; 
			swingWrapper.repaintChart();
		}
	}
}
```

# 实现效果
![](Show1.png)
可以看到不同的产生器的数据分布在不同的值之间，产生器1徘徊在1之间，产生器2徘徊在2之间以此类推
可以看到无论是处理器还是产生器在命令指示符中均正常工作，达到实验预期！
![](topic.png)
观察topic界面，可以看出在正常工作，符合预期！
