# Registro A opcional en Route 53. Si el DNS está en otro proveedor, crea a mano un registro A
# de var.domain apuntando al output public_ip.
resource "aws_route53_record" "app" {
  count = var.route53_zone_id == "" ? 0 : 1

  zone_id = var.route53_zone_id
  name    = var.domain
  type    = "A"
  ttl     = 300
  records = [aws_eip.app.public_ip]
}
