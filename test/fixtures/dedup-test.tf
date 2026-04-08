resource "aws_instance" "web" {
  instance_type = "t3.micro"
  timeout       = 30
}
