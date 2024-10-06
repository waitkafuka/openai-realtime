#!/bin/bash

git pull
cd server && yarn && pm2 reload ecosystem.config.js
cd ../web && yarn && yarn build