const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:DtTeiZzewsGAQlbosPGcsNrWAQqVCchf@yamanote.proxy.rlwy.net:29695/railway"
    }
  }
})

async function test() {
  const user = await prisma.user.findUnique({
    where: { email: 'elias157508@gmail.com' }
  })
  
  console.log('User found:', user ? 'YES' : 'NO')
  if (user) {
    console.log('Email:', user.email)
    console.log('Name:', user.name)
    console.log('Role:', user.role)
    console.log('Active:', user.active)
    console.log('Password hash (first 20 chars):', user.password.substring(0, 20))
    
    const passwordToTest = 'aspma2024'
    const isValid = await bcrypt.compare(passwordToTest, user.password)
    console.log(`\nPassword '${passwordToTest}' is valid:`, isValid)
    
    // Test with wrong password
    const isWrong = await bcrypt.compare('wrong', user.password)
    console.log(`Password 'wrong' is valid:`, isWrong)
  }
  
  await prisma.$disconnect()
}

test().catch(console.error)
