output "service_fqdn" {
  description = "Public DNS name for the service."
  value       = local.fqdn
}

output "service_url" {
  description = "Service URL to use (custom domain if configured, otherwise ALB DNS over HTTP)."
  value       = local.custom_domain_enabled ? "https://${local.fqdn}" : "http://${aws_lb.this.dns_name}"
}

output "alb_dns_name" {
  description = "ALB DNS name (useful before Route53 is ready)."
  value       = aws_lb.this.dns_name
}

output "ecr_repository_url" {
  description = "ECR repo URL to push images."
  value       = aws_ecr_repository.this.repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name."
  value       = aws_ecs_cluster.this.name
}

output "ecs_service_name" {
  description = "ECS service name."
  value       = aws_ecs_service.this.name
}

output "secrets" {
  description = "Secrets Manager ARNs to populate with real values."
  value = {
    mistral_api_key  = aws_secretsmanager_secret.mistral_api_key.arn
    pinecone_api_key = aws_secretsmanager_secret.pinecone_api_key.arn
  }
}

output "iam_roles" {
  description = "IAM roles used by the ECS task definition."
  value = {
    task_execution_role_arn = aws_iam_role.task_execution.arn
    task_role_arn           = aws_iam_role.task.arn
  }
}

output "cloudwatch_log_group" {
  description = "CloudWatch log group name."
  value       = aws_cloudwatch_log_group.this.name
}

output "ecs_schedules" {
  description = "EventBridge Scheduler schedules (start/stop) for ECS desiredCount."
  value = {
    enabled    = var.enable_ecs_schedules
    start_name = try(aws_scheduler_schedule.ecs_start[0].name, "")
    stop_name  = try(aws_scheduler_schedule.ecs_stop[0].name, "")
  }
}

output "route53_name_servers" {
  description = "If a new hosted zone was created, delegate these name servers at your registrar."
  value       = try(aws_route53_zone.this[0].name_servers, [])
}
