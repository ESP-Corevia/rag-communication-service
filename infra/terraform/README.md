# ECS/Fargate deploy (Terraform)

This folder provisions:

- ECR repository `corevia-ia-service`
- VPC (2 AZ), public subnets (ALB), private subnets (ECS tasks) + NAT Gateway
- ALB (HTTP→HTTPS) + ACM certificate + Route53 record `ia.<domain>`
- ECS Cluster + Fargate Service + CloudWatch logs
- Secrets Manager secrets for `MISTRAL_API_KEY` and `PINECONE_API_KEY`
- (Optional) EventBridge Scheduler: auto start/stop ECS service (Europe/Paris)

## Prereqs

- AWS credentials configured (`aws configure` / SSO / env vars)
- Terraform >= 1.6
- (Optional) A domain name you control (`domain_name`) if you want HTTPS + a stable hostname

## Quick start

1) Create a `terraform.tfvars`:

```hcl
domain_name = "corevia.health" # optional (leave empty to deploy without custom domain)
subdomain   = "ia"             # used only if domain_name is set

# If you want to start without a domain/HTTPS:
# domain_name   = ""
# desired_count = 0

# If you already have a hosted zone:
# hosted_zone_id = "Z123..."
```

2) Init/apply:

```bash
terraform init
terraform apply
```

3) Push an image to ECR (example using `latest`):

```bash
aws ecr get-login-password --region eu-west-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.eu-west-1.amazonaws.com
docker build -t corevia-ia-service:latest .
docker tag corevia-ia-service:latest <ECR_REPO_URL>:latest
docker push <ECR_REPO_URL>:latest
```

Then re-run:

```bash
terraform apply -var image_tag=latest
```

4) Populate secrets (required before tasks can start):

```bash
aws secretsmanager put-secret-value --secret-id <mistral_secret_arn>  --secret-string "<YOUR_MISTRAL_API_KEY>"
aws secretsmanager put-secret-value --secret-id <pinecone_secret_arn> --secret-string "<YOUR_PINECONE_API_KEY>"
```

5) Verify:

```bash
curl -s "$(terraform output -raw service_url)/health"
```

## Notes

- If Terraform created a new Route53 hosted zone, you must delegate its name servers at your registrar (see output `route53_name_servers`).
- Default resources are sized for a light production workload and can be adjusted via variables (`task_cpu`, `task_memory`).
- If you enable schedules (`enable_ecs_schedules=true`), Terraform ignores drift on ECS `desired_count` (so the Scheduler can change it without Terraform “fighting back”).
- Scheduling saves Fargate cost, but ALB + NAT Gateway will still cost money even when `desired_count=0`.
