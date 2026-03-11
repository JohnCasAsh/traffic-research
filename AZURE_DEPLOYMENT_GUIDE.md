# Azure Blue-Green Deployment Guide
# Traffic Management System

## Overview
This project uses a Blue-Green deployment strategy on Azure Static Web Apps.

| Slot  | Branch    | Purpose              | URL                          |
|-------|-----------|----------------------|------------------------------|
| Blue  | main      | Production (Live)    | your-app.azurestaticapps.net |
| Green | develop   | Staging (Testing)    | your-app-staging.azurestaticapps.net |

## How Blue-Green Works Here
1. All new features are developed and pushed to the `develop` branch.
2. GitHub Actions automatically deploys `develop` to the GREEN (staging) slot.
3. Team tests the Green environment.
4. When ready, merge `develop` into `main`.
5. GitHub Actions automatically deploys `main` to the BLUE (production) slot.
6. Production is now updated with zero downtime.

## First-Time Azure Setup Steps

### Step 1: Create Two Azure Static Web Apps
Run these commands in Azure CLI (you only do this once):

```bash
# Log in to Azure
az login

# Create resource group
az group create --name traffic-management-rg --location eastasia

# Create BLUE (production) Static Web App
az staticwebapp create \
  --name traffic-mgmt-blue \
  --resource-group traffic-management-rg \
  --location eastasia \
  --sku Free

# Create GREEN (staging) Static Web App
az staticwebapp create \
  --name traffic-mgmt-green \
  --resource-group traffic-management-rg \
  --location eastasia \
  --sku Free
```

### Step 2: Get Deployment Tokens
```bash
# Get token for Blue
az staticwebapp secrets list --name traffic-mgmt-blue --resource-group traffic-management-rg

# Get token for Green
az staticwebapp secrets list --name traffic-mgmt-green --resource-group traffic-management-rg
```

### Step 3: Add Tokens to GitHub Secrets
Go to your GitHub repository:
Settings > Secrets and variables > Actions > New repository secret

Add these two secrets:
- Name: AZURE_STATIC_WEB_APPS_API_TOKEN_BLUE   Value: (token from blue app)
- Name: AZURE_STATIC_WEB_APPS_API_TOKEN_GREEN  Value: (token from green app)

### Step 4: Initialize Git Repository
```bash
cd "c:\Users\John Asley\OneDrive\Desktop\TRAFFIC _ MANAGEMENT"
git init
git remote add origin https://github.com/YOUR_USERNAME/traffic-management-system.git
git checkout -b main
git add .
git commit -m "initial commit"
git push -u origin main

# Create develop branch
git checkout -b develop
git push -u origin develop
```

## Daily Development Workflow

### Working on a new feature
```bash
git checkout develop
git pull origin develop
# make your changes
git add .
git commit -m "feat: your feature description"
git push origin develop
# GitHub Actions auto-deploys to Green (staging)
```

### Promoting to production
```bash
git checkout main
git merge develop
git push origin main
# GitHub Actions auto-deploys to Blue (production)
```

## Environment Variables
For API keys and secrets, add them in the Azure Portal:
Azure Static Web App > Configuration > Application settings

Never commit API keys to the repository.

## Branch Protection (Recommended)
In GitHub repository settings:
- Protect `main` branch: require pull request review before merging
- Protect `develop` branch: require status checks to pass

## Current Deployment Status
- Blue (Production): not yet deployed — complete setup steps above first
- Green (Staging): not yet deployed — complete setup steps above first
