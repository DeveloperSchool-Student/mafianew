const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findUnique({ where: { username: 'ADMIN' } });
    if (!user) {
        console.log('❌ Користувача ADMIN не знайдено! Спочатку зареєструйся на сайті.');
        return;
    }
    await prisma.user.update({
        where: { id: user.id },
        data: { staffRoleKey: 'OWNER', role: 'OWNER' },
    });
    console.log(`✅ Користувач "${user.username}" (${user.id}) тепер OWNER (Власник)!`);
    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
