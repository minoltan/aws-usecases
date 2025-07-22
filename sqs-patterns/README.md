
# Unified Architecture Diagram
![Architect Diagram](public/overall.png)<br />

## 1. Order Processing (DB Write Buffer Pattern)
![Order Processing Flow](public/orderProcessing.png)<br />
**Use Case: Handle flash sale traffic spikes without overwhelming the database**

## 2. Payment Processing (FIFO Ordered Processing)
![Payment Processing Flow](public/paymentProcessing.png)<br />
**Use Case: Ensure payment steps execute in exact sequence (Auth → Capture → Settlement)**


## 3. Image Processing (Decoupled Heavy Workloads)
![Image Processing Flow](public/imageProcessing.png)<br />
**Use Case: Async image resizing without blocking user requests**

## S3 Bucket creation
## Give permission to access queue and s3
## First Dummy Queue created then added url to lambda, then real queue added in lambda, so need to remove dummy queue from lambda 