variable "project_name" {
  description = "Project name prefix for AWS resources."
  type        = string
  default     = "corevia-ia"
}

variable "aws_region" {
  description = "AWS region."
  type        = string
  default     = "eu-west-1"
}

variable "vpc_cidr" {
  description = "VPC CIDR."
  type        = string
  default     = "10.42.0.0/16"
}

variable "domain_name" {
  description = "Root domain for Route53 zone (e.g. corevia.health). Leave empty to deploy without custom domain/HTTPS (HTTP via ALB DNS only)."
  type        = string
  default     = ""
}

variable "subdomain" {
  description = "Subdomain for the service (e.g. ia)."
  type        = string
  default     = "ia"
}

variable "hosted_zone_id" {
  description = "Existing Route53 zone id. If empty, a new hosted zone is created for domain_name."
  type        = string
  default     = ""
}

variable "desired_count" {
  description = "ECS service desired count."
  type        = number
  default     = 1
}

variable "task_cpu" {
  description = "Fargate task CPU units."
  type        = number
  default     = 512
}

variable "task_memory" {
  description = "Fargate task memory (MiB)."
  type        = number
  default     = 1024
}

variable "container_port" {
  description = "Container listen port."
  type        = number
  default     = 4000
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention days."
  type        = number
  default     = 30
}

variable "pinecone_environment" {
  description = "Pinecone environment."
  type        = string
  default     = "us-east-1-aws"
}

variable "pinecone_index_name" {
  description = "Pinecone index name."
  type        = string
  default     = "corevia-medical"
}

variable "log_level" {
  description = "Application log level."
  type        = string
  default     = "info"
}

variable "image_tag" {
  description = "Container image tag to deploy (e.g. a git SHA)."
  type        = string
  default     = "latest"
}

variable "enable_stickiness" {
  description = "Enable ALB target group stickiness for Socket.io long-polling fallback."
  type        = bool
  default     = true
}

variable "alb_idle_timeout" {
  description = "ALB idle timeout in seconds (WebSocket)."
  type        = number
  default     = 3600
}
