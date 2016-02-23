#!/bin/bash

if test -n "${CLIENT_ID}"; then
  sed -i "s/YOUR_CLIENT_ID/${CLIENT_ID}/" /usr/share/nginx/html/r10k-dashboard/auth.php
  sed -i "s/YOUR_CLIENT_SECRET/${CLIENT_SECRET}/" /usr/share/nginx/html/r10k-dashboard/auth.php
fi
