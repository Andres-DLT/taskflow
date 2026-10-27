locals {
  name = "taskflow-${var.environment}"
}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# ---------------------------------------------------------------- IAM ---
# Rol mínimo de la instancia: Session Manager (acceso sin SSH) y escritura de backups en S3.

data "aws_iam_policy_document" "ec2_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "app" {
  name               = "${local.name}-instance"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.app.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Solo puede escribir (no borrar): un servidor comprometido no puede destruir los backups.
data "aws_iam_policy_document" "backups_write" {
  statement {
    actions   = ["s3:PutObject"]
    resources = ["${aws_s3_bucket.backups.arn}/postgres/*"]
  }
}

resource "aws_iam_role_policy" "backups_write" {
  name   = "backups-write"
  role   = aws_iam_role.app.id
  policy = data.aws_iam_policy_document.backups_write.json
}

resource "aws_iam_instance_profile" "app" {
  name = "${local.name}-instance"
  role = aws_iam_role.app.name
}

# ----------------------------------------------------------- instancia ---

resource "aws_key_pair" "admin" {
  key_name   = "${local.name}-admin"
  public_key = var.admin_ssh_public_key
}

resource "aws_instance" "app" {
  ami                     = data.aws_ami.ubuntu.id
  instance_type           = var.instance_type
  subnet_id               = aws_subnet.public.id
  vpc_security_group_ids  = [aws_security_group.app.id]
  key_name                = aws_key_pair.admin.key_name
  iam_instance_profile    = aws_iam_instance_profile.app.name
  disable_api_termination = var.environment == "production"

  user_data = templatefile("${path.module}/cloud-init.yaml.tftpl", {
    deploy_ssh_public_key = var.deploy_ssh_public_key
  })

  # IMDSv2 obligatorio. hop limit 2 para que los contenedores (aws-cli de backup.sh) usen el rol.
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 2
  }

  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.root_volume_size_gb
    encrypted             = true
    delete_on_termination = true
    tags                  = { Name = "${local.name}-root", Snapshot = local.name }
  }

  tags = { Name = local.name }

  lifecycle {
    # Una AMI nueva o un cambio en cloud-init no deben recrear el servidor (y su base de datos).
    ignore_changes = [ami, user_data]
  }
}

resource "aws_eip" "app" {
  domain   = "vpc"
  instance = aws_instance.app.id
  tags     = { Name = local.name }

  depends_on = [aws_internet_gateway.main]
}
