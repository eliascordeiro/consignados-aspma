#!/bin/bash
npx prisma migrate resolve --applied 20260115233344_add_convenio_table
npx prisma migrate status
