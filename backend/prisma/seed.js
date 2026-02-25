const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const STAFF_ROLES = [
    { key: 'OWNER', title: 'Власник', power: 9, color: '#ff0000' },
    { key: 'CURATOR', title: 'Куратор Адміністраторів', power: 8, color: '#ff4400' },
    { key: 'SENIOR_ADMIN', title: 'Старший Адміністратор', power: 7, color: '#ff6600' },
    { key: 'ADMIN', title: 'Адміністратор', power: 6, color: '#ff8800' },
    { key: 'JUNIOR_ADMIN', title: 'Молодший Адміністратор', power: 5, color: '#ffaa00' },
    { key: 'SENIOR_MOD', title: 'Старший Модератор', power: 4, color: '#00ccff' },
    { key: 'MOD', title: 'Модератор', power: 3, color: '#00aaff' },
    { key: 'HELPER', title: 'Хелпер', power: 2, color: '#44ddaa' },
    { key: 'TRAINEE', title: 'Стажер', power: 1, color: '#88cc88' },
];

async function main() {
    for (const r of STAFF_ROLES) {
        await prisma.staffRole.upsert({
            where: { key: r.key },
            update: { title: r.title, power: r.power, color: r.color },
            create: { key: r.key, title: r.title, power: r.power, color: r.color },
        });
        console.log(`✅ ${r.key} (${r.title})`);
    }
    console.log('\nAll staff roles seeded!');
    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
