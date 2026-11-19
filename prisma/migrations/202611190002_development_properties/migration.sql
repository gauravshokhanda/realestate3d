PRAGMA foreign_keys=OFF;
BEGIN;

CREATE TABLE "Development" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "location" TEXT,
    "description" TEXT,
    "buildingImage" TEXT,
    "logoImage" TEXT,
    "theme" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "Development_slug_key" ON "Development"("slug");

INSERT INTO "Development" ("id","slug","name","tagline","location","buildingImage","status","createdAt","updatedAt")
SELECT "id","slug","name","tagline","location","towerImage",
       CASE WHEN "status" = 'published' THEN 'published' ELSE 'draft' END, "createdAt","updatedAt"
FROM "Property";

CREATE TABLE "new_Property" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "developmentId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT,
    "beds" INTEGER,
    "baths" INTEGER,
    "sqft" INTEGER,
    "price" TEXT,
    "planImage" TEXT,
    "polygon" JSONB,
    "focus" JSONB,
    "theme" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "order" INTEGER NOT NULL DEFAULT 0,
    "heroCopy" TEXT,
    "accentColor" TEXT DEFAULT '#D8B67A',
    "presentation" JSONB,
    "amenities" JSONB,
    "legacyUnitId" TEXT,
    "roomSettings" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Property_developmentId_fkey" FOREIGN KEY ("developmentId") REFERENCES "Development" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TEMP TABLE "ordered_units" AS
SELECT "Unit".*, ROW_NUMBER() OVER (
    PARTITION BY "propertyId" ORDER BY CASE WHEN lower(trim("name")) = 'residence a' THEN 0 ELSE 1 END, "name", "id"
) AS "position"
FROM "Unit";

-- Keep primary IDs so Room and Scene foreign keys and Panorama relationships survive as-is.
INSERT INTO "new_Property" ("id","developmentId","slug","name","beds","baths","sqft","price","planImage","polygon","focus","status","heroCopy","accentColor","presentation","amenities","legacyUnitId","roomSettings","createdAt","updatedAt")
SELECT p."id",p."id",'residence-a',COALESCE(u."name",p."name"),u."beds",u."baths",u."sqft",u."price",p."planImage",
       CASE WHEN p."slug" = 'aurelia' THEN '[{"x":0.42,"y":0.33},{"x":0.58,"y":0.33},{"x":0.58,"y":0.58},{"x":0.42,"y":0.58}]' END,
       CASE WHEN p."slug" = 'aurelia' THEN '{"cx":0.5,"cy":0.455,"w":0.16,"h":0.25}' END,
       p."status",p."heroCopy",p."accentColor",p."presentation",p."amenities",u."id",u."roomSettings",p."createdAt",p."updatedAt"
FROM "Property" p LEFT JOIN "ordered_units" u ON u."propertyId" = p."id" AND u."position" = 1;

INSERT INTO "new_Property" ("id","developmentId","slug","name","beds","baths","sqft","price","status","order","legacyUnitId","roomSettings","createdAt","updatedAt")
SELECT 'legacy-unit-' || u."id",p."id",
       CASE WHEN p."slug" = 'aurelia' AND u."position" = 2 AND lower(trim(u."name")) = 'residence b' THEN 'residence-b'
            ELSE 'residence-' || u."position" END,
       u."name",u."beds",u."baths",u."sqft",u."price",'draft',u."position" - 1,u."id",u."roomSettings",p."createdAt",p."updatedAt"
FROM "ordered_units" u JOIN "Property" p ON p."id" = u."propertyId"
WHERE u."position" > 1;

DROP TABLE "ordered_units";
DROP TABLE "Unit";
DROP TABLE "Property";
ALTER TABLE "new_Property" RENAME TO "Property";
CREATE UNIQUE INDEX "Property_legacyUnitId_key" ON "Property"("legacyUnitId");
CREATE UNIQUE INDEX "Property_developmentId_slug_key" ON "Property"("developmentId","slug");

CREATE TABLE "Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "developmentId" TEXT,
    "propertyId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Lead_developmentId_fkey" FOREIGN KEY ("developmentId") REFERENCES "Development" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Lead_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

COMMIT;
PRAGMA foreign_keys=ON;
