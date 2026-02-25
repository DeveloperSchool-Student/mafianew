INSERT INTO "StaffRole" (key, title, power, color) VALUES
('OWNER', 'Власник', 9, '#ff0000'),
('CURATOR', 'Куратор Адміністраторів', 8, '#ff4400'),
('SENIOR_ADMIN', 'Старший Адміністратор', 7, '#ff6600'),
('ADMIN', 'Адміністратор', 6, '#ff8800'),
('JUNIOR_ADMIN', 'Молодший Адміністратор', 5, '#ffaa00'),
('SENIOR_MOD', 'Старший Модератор', 4, '#00ccff'),
('MOD', 'Модератор', 3, '#00aaff'),
('HELPER', 'Хелпер', 2, '#44ddaa'),
('TRAINEE', 'Стажер', 1, '#88cc88')
ON CONFLICT (key) DO UPDATE SET title = EXCLUDED.title, power = EXCLUDED.power, color = EXCLUDED.color;
