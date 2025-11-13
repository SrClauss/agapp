#!/bin/bash

# Test runner script for Agiliza project
# Usage: ./scripts/test.sh [backend|frontend-web|frontend-mobile|all] [options]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
TARGET="all"
COVERAGE=true
VERBOSE=false
INTEGRATION=false
E2E=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        backend|frontend-web|frontend-mobile|all)
            TARGET=$1
            shift
            ;;
        --no-coverage)
            COVERAGE=false
            shift
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --integration|-i)
            INTEGRATION=true
            shift
            ;;
        --e2e)
            E2E=true
            shift
            ;;
        --help|-h)
            echo "Usage: ./scripts/test.sh [backend|frontend-web|frontend-mobile|all] [options]"
            echo ""
            echo "Options:"
            echo "  --no-coverage     Disable coverage reports"
            echo "  --verbose, -v     Verbose output"
            echo "  --integration, -i Run integration tests only"
            echo "  --e2e             Run end-to-end tests"
            echo "  --help, -h        Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

echo -e "${GREEN}=== Agiliza Test Suite ===${NC}"
echo "Target: $TARGET"
echo ""

# Start MongoDB for tests
start_mongodb() {
    echo -e "${YELLOW}Starting MongoDB test instance...${NC}"
    docker-compose -f docker-compose.test.yml up -d mongodb-test
    sleep 3
}

# Stop test containers
cleanup() {
    echo -e "${YELLOW}Cleaning up...${NC}"
    docker-compose -f docker-compose.test.yml down
}

# Trap cleanup on exit
trap cleanup EXIT

# Backend tests
run_backend_tests() {
    echo -e "${GREEN}=== Running Backend Tests ===${NC}"

    start_mongodb

    PYTEST_ARGS="-v"

    if [ "$COVERAGE" = true ]; then
        PYTEST_ARGS="$PYTEST_ARGS --cov=app --cov-report=html --cov-report=term-missing --cov-report=xml"
    fi

    if [ "$INTEGRATION" = true ]; then
        PYTEST_ARGS="$PYTEST_ARGS -m integration"
    fi

    if [ "$E2E" = true ]; then
        PYTEST_ARGS="$PYTEST_ARGS -m e2e"
    fi

    # Run tests in Docker
    docker-compose -f docker-compose.test.yml run --rm backend-test pytest $PYTEST_ARGS

    if [ "$COVERAGE" = true ]; then
        echo -e "${GREEN}Coverage report generated at: backend/htmlcov/index.html${NC}"
    fi
}

# Frontend Web tests
run_frontend_web_tests() {
    echo -e "${GREEN}=== Running Frontend Web Tests ===${NC}"

    cd frontend/web

    if [ "$COVERAGE" = true ]; then
        npm run test:coverage
    else
        npm run test
    fi

    cd ../..

    if [ "$COVERAGE" = true ]; then
        echo -e "${GREEN}Coverage report generated at: frontend/web/coverage/index.html${NC}"
    fi
}

# Frontend Mobile tests
run_frontend_mobile_tests() {
    echo -e "${GREEN}=== Running Frontend Mobile Tests ===${NC}"

    cd frontend/mobile

    if [ "$COVERAGE" = true ]; then
        npm run test:coverage
    else
        npm run test
    fi

    cd ../..

    if [ "$COVERAGE" = true ]; then
        echo -e "${GREEN}Coverage report generated at: frontend/mobile/coverage/index.html${NC}"
    fi
}

# E2E tests
run_e2e_tests() {
    echo -e "${GREEN}=== Running E2E Tests ===${NC}"

    # Start all services
    docker-compose -f docker-compose.test.yml up -d

    # Wait for services to be ready
    echo "Waiting for services to be ready..."
    sleep 10

    # Run Playwright tests
    cd tests/e2e
    npx playwright test
    cd ../..

    echo -e "${GREEN}E2E test report generated at: tests/e2e/playwright-report/index.html${NC}"
}

# Run tests based on target
case $TARGET in
    backend)
        run_backend_tests
        ;;
    frontend-web)
        run_frontend_web_tests
        ;;
    frontend-mobile)
        run_frontend_mobile_tests
        ;;
    all)
        run_backend_tests
        run_frontend_web_tests
        run_frontend_mobile_tests

        if [ "$E2E" = true ]; then
            run_e2e_tests
        fi
        ;;
esac

echo -e "${GREEN}=== Tests Complete ===${NC}"
