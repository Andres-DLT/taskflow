environment   = "staging"
aws_region    = "eu-west-1"
instance_type = "t3.small"
domain        = "staging.example.com"

# Deja vacío si tu DNS no está en Route 53.
route53_zone_id = ""

# Sustituye por tus claves públicas (ver README, paso 2).
admin_ssh_public_key  = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIREPLACE_ME admin@laptop"
deploy_ssh_public_key = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIREPLACE_ME github-actions-staging"

backup_retention_days    = 14
snapshot_retention_count = 3
alarm_email              = ""
