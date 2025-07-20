# aws-usecases
This repo will demonstrae the aws services feature 

## TABLE OF CONTENTS
1. [Setup](#SETUP)
2. [Deployment](#DEPLOYMENT)
3. [SQS](#SQS)  
4. [Author](#AUTHOR)

## SETUP

### AWS Cost Management & Good Practices
1. Use the AWS Free Tier Wisely: AWS gives you many services for free up to certain limits (some forever, some for 12 months). This is great for learning and building small apps without paying. Always check your usage to stay within these free limits using tools like the Cost Management Dashboard.

2. "Turn Off the Lights": If you're not using AWS resources (like servers or databases), shut them down or delete them. Just like turning off lights when you leave a room, this saves money. The AWS CDK helps a lot: cdk deploy builds your app, and cdk destroy easily removes everything, preventing unexpected costs.

3. Keep Your Account Secure: Never share your AWS account details or passwords. If someone else gets access, they could create expensive resources on your account without you knowing.

4. Minimize the use of your powerful AWS root account. Instead, create and use IAM users with specific, limited permissions for all your regular AWS activities to significantly enhance the security of your cloud environment.

**Note: Maintain the granular access and policies for all AWS resources to prevent unauthorized access and ensure the security of your AWS account. Here I used all access for the sake of simplicity.**

### Prerequisites 
1. **[Need AWS Account with programatic access](https://docs.aws.amazon.com/keyspaces/latest/devguide/access.credentials.IAM.html)** 
2. **[AWS CLI Install](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)**
3. **[AWS CLI Quick Setup](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-quickstart.html)**
4. **[AWS CLI Configuration and credential file settings](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html)**
5. **[Node.js](https://nodejs.org/en/)**<br /> 
**This is a crucial prerequisite for two reasons:**
- It's required for running AWS CDK (Cloud Development Kit) applications.
- Your AWS Lambda functions will be developed using Node.js.
6. **[AWS CDK Toolkit](https://docs.aws.amazon.com/cdk/v2/guide/home.html)**
- ```npm install -g aws-cdk```
7. **[Working with the AWS CDK in TypeScript](https://docs.aws.amazon.com/cdk/v2/guide/work-with-cdk-typescript.html)**
8. **[IDE (Visual Studio Code)](https://code.visualstudio.com/)**

## DEPLOYMENT

### The AWS CDK Workflow:
1. **Initialize Application:** Create a new CDK project using the ```cdk init``` command. This sets up a basic project template.

2. ***Add Code to Create Resources:** Write code within your application to define AWS resources (called Constructs) inside a Stack. For example, you might add code to create an SQS queue or an S3 bucket.

3. **Build Application (Optional):** While ```cdk``` commands often handle this automatically, you can manually build your application to catch syntax and type errors.

4. **Synthesize Stacks:** Run ```cdk synthesize``` to transform your CDK code into an AWS CloudFormation template. This step helps catch logical errors in your resource definitions.

5. Deploy Stacks: Use ```cdk deploy``` to provision the resources defined in your CloudFormation template onto your AWS account. This step might uncover permission issues if the CDK toolkit lacks necessary permissions.

### Key Best Practices & Lifecycle:
- The build step catches basic coding errors (syntax, types).
- The synthesize step identifies logical errors in your AWS resource definitions.
- The deploy step can reveal permission problems.
- The general lifecycle involves: **Code → Build → Synthesize → Deploy → Fix issues → Repeat**.

### Sample Project Creation & Structure
1. **Create a Project Directory:**
- Open your command window (e.g., Windows Terminal).
- Navigate to your desired location.
- Create a new directory named ```hello-cdk``` using the command: ```mkdir hello-cdk```.
- Important: Use this exact name (```hello-cdk```) as it aligns with an AWS CDK training project template.
- Change into the newly created directory: ```cd hello-cdk```.
2. **Initialize the CDK Application:**
- Inside the hello-cdk directory, run the CDK initialization command: ```cdk init app --language typescript```
- CDK will then execute npm install to set up necessary dependencies and create a structured project with various files and folders. 
3. **Open the Project in Visual Studio Code (VS Code):**
- From within the ```hello-cdk ```directory in your command window, type: ```code .``` and press Enter.
4. **Structured layout created by CDK:**
- ```bin``` **folder:** This typically contains the entry point for your CDK application.
- ```lib``` **folder:** This is where you'll define your infrastructure. Inside ```lib```, you'll find a TypeScript file (e.g., ```hello-cdk-stack.ts```) which defines your CDK Stack. This is where you'll write code to define AWS resources using TypeScript.
- ```node_modules``` **folder**: This contains all the NPM packages and dependencies installed during the ```cdk init``` process.
- ```cdk.json```: CDK-specific configuration.
- ```package.json```: Node.js project configuration, including scripts and dependencies.
- ```package-lock.json```: Locks the exact versions of dependencies used in your project.

5. **Each microservice folder creation**
# Create directory and initialize package.json
- ```mkdir -p src/handlers/order-submit```
- ```cd src/handlers/order-submit```
- ```npm init -y```

6. **Install Docker and Ensure It's Running:**
- ```sudo apt-get update```
- ```sudo apt-get install docker.io```
- ```sudo systemctl start docker```
- ```sudo systemctl enable docker```
- ```sudo usermod -aG docker $USER```

### CDK Commands
- **```cdk verion```** Show the version
- **```cdk init```** Initializes a new CDK project.
- **```cdk list```** List the stack.
- **```cdk synth```** Synthesizes the CDK code into a CloudFormation template.
- **```cdk diff```** Compares the current state of your AWS resources with the state defined in your
- **```cdk bootstrap```** Initializes the AWS CDK toolkit in your AWS account.
- **```cdk deploy```** Deploys the synthesized CloudFormation template to AWS.
- **```cdk destroy```** Destroys the AWS resources created by the CDK.

## SQS
- **Get inside of the folder**  ```cd sqs-patters```
- **Install required dependencies**
npm install @aws-cdk/aws-sqs @aws-cdk/aws-lambda @aws-cdk/aws-apigateway @aws-cdk/aws-dynamodb @aws-cdk/aws-lambda-event-sources
- **For SQS details, visit sqs-patterns/src/README.md** 