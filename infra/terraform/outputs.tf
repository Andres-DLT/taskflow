output "public_ip" {
  description = "IP elástica del servidor (registro DNS A y variable DEPLOY_HOST de GitHub)."
  value       = aws_eip.app.public_ip
}

output "instance_id" {
  description = "ID de la instancia EC2."
  value       = aws_instance.app.id
}

output "backup_bucket" {
  description = "Bucket S3 de backups (BACKUP_S3_BUCKET en /opt/app/.env)."
  value       = aws_s3_bucket.backups.bucket
}

output "ssh_admin" {
  description = "Acceso de administración por SSH."
  value       = "ssh ubuntu@${aws_eip.app.public_ip}"
}

output "ssm_session" {
  description = "Acceso sin SSH vía AWS Systems Manager."
  value       = "aws ssm start-session --target ${aws_instance.app.id} --region ${var.aws_region}"
}

output "known_hosts_command" {
  description = "Comando para obtener el secreto SSH_KNOWN_HOSTS (verifica la huella antes de usarlo)."
  value       = "ssh-keyscan -t ed25519 ${aws_eip.app.public_ip}"
}
