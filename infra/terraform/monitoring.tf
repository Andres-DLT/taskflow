# Auto-recuperación de la instancia si falla el hardware subyacente de AWS,
# y notificación por email (opcional) cuando falla cualquier status check.

resource "aws_sns_topic" "alarms" {
  count = var.alarm_email == "" ? 0 : 1
  name  = "${local.name}-alarms"
}

resource "aws_sns_topic_subscription" "alarms_email" {
  count     = var.alarm_email == "" ? 0 : 1
  topic_arn = aws_sns_topic.alarms[0].arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

resource "aws_cloudwatch_metric_alarm" "system_recover" {
  alarm_name          = "${local.name}-system-status-recover"
  alarm_description   = "Recupera la instancia en otro host si falla el status check de sistema"
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed_System"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 2
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  dimensions          = { InstanceId = aws_instance.app.id }
  alarm_actions       = concat(["arn:aws:automate:${var.aws_region}:ec2:recover"], aws_sns_topic.alarms[*].arn)
}

resource "aws_cloudwatch_metric_alarm" "instance_status" {
  count               = var.alarm_email == "" ? 0 : 1
  alarm_name          = "${local.name}-instance-status"
  alarm_description   = "Falla el status check de la instancia (SO, red, disco)"
  namespace           = "AWS/EC2"
  metric_name         = "StatusCheckFailed_Instance"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 3
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  dimensions          = { InstanceId = aws_instance.app.id }
  alarm_actions       = aws_sns_topic.alarms[*].arn
  ok_actions          = aws_sns_topic.alarms[*].arn
}
