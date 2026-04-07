# Test fixture: timeout keyword only → should trigger Timeout rule only
# cache_ttl and replicas removed to verify *.tf alone does NOT trigger cache/replica rules

resource "aws_lb_target_group" "api" {
  name     = "api"
  port     = 80
  protocol = "HTTP"

  health_check {
    timeout  = 30
    interval = 60
  }
}
