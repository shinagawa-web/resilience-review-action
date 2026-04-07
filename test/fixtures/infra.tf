# Test fixture: triggers timeout, replicas, and cache rules

resource "aws_elasticache_cluster" "example" {
  cluster_id      = "example"
  engine          = "redis"
  node_type       = "cache.t3.micro"
  cache_ttl       = 3600
}

resource "aws_ecs_service" "api" {
  name          = "api"
  desired_count = 1
  replicas      = 1
}

resource "aws_lb_target_group" "api" {
  name     = "api"
  port     = 80
  protocol = "HTTP"

  health_check {
    timeout  = 30
    interval = 60
  }
}
