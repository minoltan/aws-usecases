
# Unified Architecture Diagram
![Architect Diagram](src/public/overall.png)<br />

## 1. Order Processing (DB Write Buffer Pattern)
![Order Processing Flow](src/public/orderProcessing.png)<br />
**Use Case: Handle flash sale traffic spikes without overwhelming the database**

## 2. Payment Processing (FIFO Ordered Processing)
![Payment Processing Flow](src/public/paymentProcessing.png)<br />
**Use Case: Ensure payment steps execute in exact sequence (Auth → Capture → Settlement)**


## 3. Image Processing (Decoupled Heavy Workloads)
![Image Processing Flow](src/public/imageProcessing.png)<br />
**Use Case: Async image resizing without blocking user requests**