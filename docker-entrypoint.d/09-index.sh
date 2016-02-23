#!/bin/bash

sed -i "s/<YOUR_GITHUB_ORG>/${GITHUB_ORG}/" /usr/share/nginx/html/r10k-dashboard/index.html
sed -i "s/<YOUR_GITHUB_R10K_REPO>/${R10K_REPO}/" /usr/share/nginx/html/r10k-dashboard/index.html
