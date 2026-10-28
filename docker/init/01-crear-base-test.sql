-- Base separada para los tests automáticos: se recrea en cada corrida de `npm test`
-- sin tocar los datos de desarrollo.
CREATE DATABASE sigcan_test OWNER sigcan;
