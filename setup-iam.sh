#!/bin/bash

# Setup IAM roles for Elastic Beanstalk

echo "🔐 Setting up IAM roles for Elastic Beanstalk..."

# Create EC2 instance profile and role
echo "Creating EC2 instance profile..."
aws iam create-role \
    --role-name aws-elasticbeanstalk-ec2-role \
    --assume-role-policy-document '{
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {
                    "Service": "ec2.amazonaws.com"
                },
                "Action": "sts:AssumeRole"
            }
        ]
    }' 2>/dev/null || echo "Role already exists or created"

# Attach managed policies
echo "Attaching managed policies..."
aws iam attach-role-policy \
    --role-name aws-elasticbeanstalk-ec2-role \
    --policy-arn arn:aws:iam::aws:policy/AWSElasticBeanstalkWebTier \
    2>/dev/null || echo "Policy already attached"

aws iam attach-role-policy \
    --role-name aws-elasticbeanstalk-ec2-role \
    --policy-arn arn:aws:iam::aws:policy/AWSElasticBeanstalkMulticontainerDocker \
    2>/dev/null || echo "Policy already attached"

aws iam attach-role-policy \
    --role-name aws-elasticbeanstalk-ec2-role \
    --policy-arn arn:aws:iam::aws:policy/AWSElasticBeanstalkWorkerTier \
    2>/dev/null || echo "Policy already attached"

# Create instance profile
echo "Creating instance profile..."
aws iam create-instance-profile \
    --instance-profile-name aws-elasticbeanstalk-ec2-role \
    2>/dev/null || echo "Instance profile already exists"

# Add role to instance profile
aws iam add-role-to-instance-profile \
    --instance-profile-name aws-elasticbeanstalk-ec2-role \
    --role-name aws-elasticbeanstalk-ec2-role \
    2>/dev/null || echo "Role already added to instance profile"

# Create service role
echo "Creating service role..."
aws iam create-role \
    --role-name aws-elasticbeanstalk-service-role \
    --assume-role-policy-document '{
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {
                    "Service": "elasticbeanstalk.amazonaws.com"
                },
                "Action": "sts:AssumeRole"
            }
        ]
    }' 2>/dev/null || echo "Service role already exists"

# Attach service role policy
aws iam attach-role-policy \
    --role-name aws-elasticbeanstalk-service-role \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSElasticBeanstalkService \
    2>/dev/null || echo "Service policy already attached"

echo "✅ IAM roles setup complete!"
echo "⏳ Waiting 10 seconds for roles to propagate..."
sleep 10
