#!/bin/bash

# AWS Deployment Script for PDF Template Engine
# This script builds Docker images and deploys to AWS Elastic Beanstalk

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting AWS deployment...${NC}"

# Configuration - Tokyo region
AWS_REGION="${AWS_REGION:-ap-northeast-1}"
ECR_REPO_NAME="${ECR_REPO_NAME:-pdf-template-engine}"
EB_APP_NAME="${EB_APP_NAME:-pdf-template-engine}"
EB_ENV_NAME="${EB_ENV_NAME:-pdf-template-prod}"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}AWS CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if Docker is installed and running
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker is not installed. Please install it first.${NC}"
    exit 1
fi

# Get AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo -e "${RED}Failed to get AWS Account ID. Please check your AWS credentials.${NC}"
    exit 1
fi
ECR_REPO_URL="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO_NAME}"

echo -e "${YELLOW}AWS Account ID: ${AWS_ACCOUNT_ID}${NC}"
echo -e "${YELLOW}ECR Repository URL: ${ECR_REPO_URL}${NC}"

# Login to ECR
echo -e "${GREEN}Logging into ECR...${NC}"
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REPO_URL}

# Create ECR repositories if they don't exist (separate repos for backend/frontend)
echo -e "${GREEN}Creating ECR repositories if needed...${NC}"
if ! aws ecr describe-repositories --repository-names ${ECR_REPO_NAME}/backend --region ${AWS_REGION} &>/dev/null; then
    echo -e "${YELLOW}Creating backend repository...${NC}"
    aws ecr create-repository --repository-name ${ECR_REPO_NAME}/backend --region ${AWS_REGION}
else
    echo -e "${GREEN}Backend repository already exists${NC}"
fi

if ! aws ecr describe-repositories --repository-names ${ECR_REPO_NAME}/frontend --region ${AWS_REGION} &>/dev/null; then
    echo -e "${YELLOW}Creating frontend repository...${NC}"
    aws ecr create-repository --repository-name ${ECR_REPO_NAME}/frontend --region ${AWS_REGION}
else
    echo -e "${GREEN}Frontend repository already exists${NC}"
fi

# Build and push backend image
echo -e "${GREEN}Building backend Docker image...${NC}"
docker build -t ${ECR_REPO_NAME}/backend:latest ./backend

echo -e "${GREEN}Tagging backend image...${NC}"
docker tag ${ECR_REPO_NAME}/backend:latest ${ECR_REPO_URL}/backend:latest

echo -e "${GREEN}Pushing backend image to ECR...${NC}"
docker push ${ECR_REPO_URL}/backend:latest

# Build and push frontend image
echo -e "${GREEN}Building frontend Docker image...${NC}"
docker build -t ${ECR_REPO_NAME}/frontend:latest ./frontend

echo -e "${GREEN}Tagging frontend image...${NC}"
docker tag ${ECR_REPO_NAME}/frontend:latest ${ECR_REPO_URL}/frontend:latest

echo -e "${GREEN}Pushing frontend image to ECR...${NC}"
docker push ${ECR_REPO_URL}/frontend:latest

# Create application version using Dockerfile (not Dockerrun.aws.json)
# Latest EB Docker platform supports Dockerfile directly
VERSION_LABEL="v$(date +%Y%m%d-%H%M%S)"
S3_BUCKET="${EB_APP_NAME}-deployments-${AWS_ACCOUNT_ID}"
ZIP_FILE="deploy-${VERSION_LABEL}.zip"

echo -e "${GREEN}Creating application version: ${VERSION_LABEL}...${NC}"

# Package the application with Dockerfile
echo -e "${GREEN}Packaging application with Dockerfile...${NC}"
if [ -f "Dockerfile" ]; then
    if [ -d ".ebextensions" ] && [ "$(ls -A .ebextensions)" ]; then
        zip -r ${ZIP_FILE} Dockerfile .ebextensions/ backend/ frontend/ -x "*/node_modules/*" "*/__pycache__/*" "*/venv/*" "*.git/*"
    else
        zip -r ${ZIP_FILE} Dockerfile backend/ frontend/ -x "*/node_modules/*" "*/__pycache__/*" "*/venv/*" "*.git/*"
    fi
elif [ -f "Dockerrun.aws.json" ]; then
    # Fallback to Dockerrun.aws.json if Dockerfile doesn't exist
    echo -e "${YELLOW}Using Dockerrun.aws.json (Dockerfile not found)...${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|YOUR_ECR_REPO_URL|${ECR_REPO_URL}|g" Dockerrun.aws.json
    else
        sed -i.bak "s|YOUR_ECR_REPO_URL|${ECR_REPO_URL}|g" Dockerrun.aws.json
    fi
    if [ -d ".ebextensions" ] && [ "$(ls -A .ebextensions)" ]; then
        zip -r ${ZIP_FILE} Dockerrun.aws.json .ebextensions/
    else
        zip -r ${ZIP_FILE} Dockerrun.aws.json
    fi
else
    echo -e "${RED}Error: Neither Dockerfile nor Dockerrun.aws.json found!${NC}"
    exit 1
fi

# Create S3 bucket if it doesn't exist
echo -e "${GREEN}Ensuring S3 bucket exists...${NC}"
if ! aws s3 ls "s3://${S3_BUCKET}" 2>/dev/null; then
    echo -e "${YELLOW}Creating S3 bucket: ${S3_BUCKET}...${NC}"
    if [ "${AWS_REGION}" == "us-east-1" ]; then
        aws s3 mb "s3://${S3_BUCKET}" --region ${AWS_REGION}
    else
        aws s3api create-bucket \
            --bucket ${S3_BUCKET} \
            --region ${AWS_REGION} \
            --create-bucket-configuration LocationConstraint=${AWS_REGION}
    fi
else
    echo -e "${GREEN}S3 bucket already exists${NC}"
fi

# Upload zip file to S3
echo -e "${GREEN}Uploading deployment package to S3...${NC}"
aws s3 cp ${ZIP_FILE} "s3://${S3_BUCKET}/${ZIP_FILE}" --region ${AWS_REGION}

# Create application version in Elastic Beanstalk
echo -e "${GREEN}Creating Elastic Beanstalk application version...${NC}"
aws elasticbeanstalk create-application-version \
    --application-name ${EB_APP_NAME} \
    --version-label ${VERSION_LABEL} \
    --source-bundle S3Bucket="${S3_BUCKET}",S3Key="${ZIP_FILE}" \
    --auto-create-application \
    --region ${AWS_REGION} 2>/dev/null || \
    aws elasticbeanstalk create-application-version \
        --application-name ${EB_APP_NAME} \
        --version-label ${VERSION_LABEL} \
        --source-bundle S3Bucket="${S3_BUCKET}",S3Key="${ZIP_FILE}" \
        --region ${AWS_REGION}

# Create or update environment
echo -e "${GREEN}Creating/Updating Elastic Beanstalk environment...${NC}"
ENV_EXISTS=$(aws elasticbeanstalk describe-environments \
    --application-name ${EB_APP_NAME} \
    --environment-names ${EB_ENV_NAME} \
    --region ${AWS_REGION} \
    --query 'Environments[0].EnvironmentName' \
    --output text 2>/dev/null)

if [ "$ENV_EXISTS" == "${EB_ENV_NAME}" ]; then
    echo -e "${GREEN}Updating existing environment...${NC}"
    aws elasticbeanstalk update-environment \
        --application-name ${EB_APP_NAME} \
        --environment-name ${EB_ENV_NAME} \
        --version-label ${VERSION_LABEL} \
        --region ${AWS_REGION}
else
    echo -e "${YELLOW}Environment does not exist. Creating new environment...${NC}"
    echo -e "${YELLOW}This may take 10-15 minutes...${NC}"
    
    # Try to create environment with service role (if exists)
    SERVICE_ROLE="aws-elasticbeanstalk-service-role"
    if aws iam get-role --role-name ${SERVICE_ROLE} &>/dev/null; then
        echo -e "${GREEN}Using service role: ${SERVICE_ROLE}${NC}"
        aws elasticbeanstalk create-environment \
            --application-name ${EB_APP_NAME} \
            --environment-name ${EB_ENV_NAME} \
            --solution-stack-name "64bit Amazon Linux 2023 v4.9.1 running Docker" \
            --version-label ${VERSION_LABEL} \
            --service-role ${SERVICE_ROLE} \
            --region ${AWS_REGION}
    else
        echo -e "${YELLOW}Service role not found, creating without explicit role (EB will create default)${NC}"
        aws elasticbeanstalk create-environment \
            --application-name ${EB_APP_NAME} \
            --environment-name ${EB_ENV_NAME} \
            --solution-stack-name "64bit Amazon Linux 2023 v4.9.1 running Docker" \
            --version-label ${VERSION_LABEL} \
            --option-settings Namespace=aws:autoscaling:launchconfiguration,OptionName=IamInstanceProfile,Value=aws-elasticbeanstalk-ec2-role \
            --region ${AWS_REGION}
    fi
fi

echo -e "${GREEN}Deployment initiated!${NC}"
echo -e "${YELLOW}Check the status with: aws elasticbeanstalk describe-environments --environment-names ${EB_ENV_NAME} --region ${AWS_REGION}${NC}"

# Clean up
rm -f ${ZIP_FILE}
mv Dockerrun.aws.json.bak Dockerrun.aws.json 2>/dev/null || true
