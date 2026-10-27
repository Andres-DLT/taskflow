environment   = "production"
aws_region    = "eu-west-1"
instance_type = "t3.medium"
domain        = "app.example.com"

# Deja vacío si tu DNS no está en Route 53.
route53_zone_id = ""

# Sustituye por tus claves públicas (ver README, paso 2). La clave de deploy es distinta a la de staging.
admin_ssh_public_key  = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIREPLACE_ME admin@laptop"
deploy_ssh_public_key = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIREPLACE_ME github-actions-production"

root_volume_size_gb      = 50
backup_retention_days    = 30
snapshot_retention_count = 7
alarm_email              = "ops@example.com"
