#!/bin/bash

sed -i "s/<YOUR_GITHUB_ORG>/${GITHUB_ORG}/" /var/www/html/index.html
sed -i "s/<YOUR_R10K_REPO>/${R10K_REPO}/" /var/www/html/index.html
