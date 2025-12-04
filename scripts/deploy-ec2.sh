#!/bin/bash

###############################################################################
# Corevia IA Service - EC2 Deployment Script
#
# This script deploys the application to an EC2 instance using Docker
# Usage: ./scripts/deploy-ec2.sh [ENVIRONMENT]
# Example: ./scripts/deploy-ec2.sh production
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
APP_NAME="corevia-ia-service"
APP_DIR="/opt/${APP_NAME}"
DOCKER_IMAGE="${APP_NAME}:latest"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Corevia IA Service - EC2 Deployment${NC}"
echo -e "${BLUE}  Environment: ${ENVIRONMENT}${NC}"
echo -e "${BLUE}========================================${NC}"

# Function to print step
print_step() {
    echo -e "\n${GREEN}[STEP]${NC} $1"
}

# Function to print error
print_error() {
    echo -e "\n${RED}[ERROR]${NC} $1"
}

# Function to print warning
print_warning() {
    echo -e "\n${YELLOW}[WARNING]${NC} $1"
}

# Check if running on EC2
print_step "Checking environment..."
if [ ! -f /sys/hypervisor/uuid ] && [ ! -f /sys/devices/virtual/dmi/id/product_uuid ]; then
    print_warning "This script is designed to run on EC2. Are you sure you want to continue? (y/n)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        exit 0
    fi
fi

# Check if Docker is installed
print_step "Checking Docker installation..."
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    echo "Run: curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create application directory
print_step "Creating application directory..."
sudo mkdir -p ${APP_DIR}
sudo mkdir -p ${APP_DIR}/logs

# Check if .env file exists
print_step "Checking environment configuration..."
if [ ! -f .env ]; then
    print_error ".env file not found!"
    echo "Please create a .env file with the following variables:"
    cat .env.example
    exit 1
fi

# Copy files to app directory
print_step "Copying application files..."
sudo cp -r . ${APP_DIR}/
sudo cp .env ${APP_DIR}/.env

# Set proper permissions
print_step "Setting permissions..."
sudo chown -R $USER:$USER ${APP_DIR}

# Navigate to app directory
cd ${APP_DIR}

# Stop existing containers
print_step "Stopping existing containers..."
if docker ps -a | grep -q ${APP_NAME}; then
    docker-compose down || true
fi

# Clean up old images (optional, uncomment if needed)
# print_step "Cleaning up old Docker images..."
# docker image prune -f

# Build new image
print_step "Building Docker image..."
docker-compose build --no-cache

# Start containers
print_step "Starting containers..."
docker-compose up -d

# Wait for container to be healthy
print_step "Waiting for application to be healthy..."
sleep 10

# Check container status
if docker ps | grep -q ${APP_NAME}; then
    echo -e "${GREEN}Container is running!${NC}"
    docker ps | grep ${APP_NAME}
else
    print_error "Container failed to start!"
    echo "Container logs:"
    docker logs ${APP_NAME}
    exit 1
fi

# Show logs
print_step "Recent logs:"
docker logs --tail 50 ${APP_NAME}

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}  Deployment completed successfully!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "\nUseful commands:"
echo -e "  View logs:          ${BLUE}docker logs -f ${APP_NAME}${NC}"
echo -e "  Restart service:    ${BLUE}docker-compose restart${NC}"
echo -e "  Stop service:       ${BLUE}docker-compose down${NC}"
echo -e "  Check status:       ${BLUE}docker ps${NC}"
echo -e "  Enter container:    ${BLUE}docker exec -it ${APP_NAME} sh${NC}"
