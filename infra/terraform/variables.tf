variable "environment" {
  description = "Nombre del entorno."
  type        = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment debe ser staging o production."
  }
}

variable "aws_region" {
  description = "Región de AWS."
  type        = string
  default     = "eu-west-1"
}

variable "vpc_cidr" {
  description = "Rango de la VPC dedicada."
  type        = string
  default     = "10.40.0.0/16"
}

variable "instance_type" {
  description = "Tipo de instancia EC2."
  type        = string
  default     = "t3.small"
}

variable "root_volume_size_gb" {
  description = "Tamaño del disco raíz (gp3, cifrado)."
  type        = number
  default     = 30
}

variable "domain" {
  description = "Dominio público de la aplicación (p. ej. app.example.com)."
  type        = string
}

variable "route53_zone_id" {
  description = "Zona de Route 53 donde crear el registro A. Vacío si el DNS se gestiona fuera de AWS."
  type        = string
  default     = ""
}

variable "ssh_ingress_cidrs" {
  description = <<-EOT
    Orígenes permitidos para SSH. Los runners de GitHub no tienen IP fija, por eso el valor por defecto
    es abierto (solo clave pública, sin contraseñas, fail2ban). Para endurecerlo: runner self-hosted,
    VPN (Tailscale/WireGuard) o despliegue vía SSM, y restringir aquí a tus IPs.
  EOT
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "admin_ssh_public_key" {
  description = "Clave pública SSH del administrador (usuario ubuntu)."
  type        = string

  validation {
    condition     = can(regex("^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp256) ", var.admin_ssh_public_key))
    error_message = "admin_ssh_public_key debe ser una clave pública OpenSSH."
  }
}

variable "deploy_ssh_public_key" {
  description = "Clave pública SSH que usa GitHub Actions para desplegar (usuario deploy)."
  type        = string

  validation {
    condition     = can(regex("^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp256) ", var.deploy_ssh_public_key))
    error_message = "deploy_ssh_public_key debe ser una clave pública OpenSSH."
  }
}

variable "backup_retention_days" {
  description = "Días que se conservan los backups de PostgreSQL en S3."
  type        = number
  default     = 30
}

variable "snapshot_retention_count" {
  description = "Número de snapshots EBS diarios que se conservan."
  type        = number
  default     = 7
}

variable "alarm_email" {
  description = "Email que recibe las alarmas de CloudWatch. Vacío para no crear notificaciones."
  type        = string
  default     = ""
}
