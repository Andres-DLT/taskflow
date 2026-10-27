terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # Estado remoto en S3 con bloqueo nativo (use_lockfile, sin DynamoDB).
  # La configuración de cada entorno está en environments/<env>.backend.hcl.
  backend "s3" {}
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "taskflow"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
