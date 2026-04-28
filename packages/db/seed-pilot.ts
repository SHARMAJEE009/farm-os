import { EntityManager } from 'typeorm';
import { Farm } from '../api/src/modules/farms/farm.entity';
import { User } from '../api/src/modules/users/user.entity';
import { Paddock } from '../api/src/modules/paddocks/paddock.entity';
import { Mob } from '../api/src/modules/mob/mob.entity';
import { MobPaddockAssignment } from '../api/src/modules/mob-assignment/mob-assignment.entity';
import { HealthEvent } from '../api/src/modules/health-event/health-event.entity';
import { WeighEvent } from '../api/src/modules/weigh-event/weigh-event.entity';
import { Species } from '../api/src/modules/livestock-master/species.entity';
import { Breed } from '../api/src/modules/livestock-master/breed.entity';
import { FinancialTransaction } from '../api/src/modules/financial-transactions/financial-transaction.entity';
import { Recommendation } from '../api/src/modules/recommendations/recommendation.entity';
import { SupplierOrder } from '../api/src/modules/supplier-orders/supplier-order.entity';
import * as bcrypt from 'bcryptjs';

/**
 * Realistic Seed Script for Riverdale Station Pilot Demo
 * Uses TypeORM EntityManager as requested.
 */
export async function seedPilot(manager: EntityManager) {
  console.log('🌱 Starting Pilot Seed: Riverdale Station...');

  // 1. Create Farm
  const farm = manager.create(Farm, {
    name: 'Riverdale Station',
    location: 'Narromine, NSW',
    country: 'Australia',
  });
  await manager.save(farm);

  // 2. Create Users
  const passwordHash = await bcrypt.hash('pilot2026', 10);
  
  const owner = manager.create(User, {
    name: 'James Whitfield',
    email: 'owner@riverdale.com',
    password_hash: passwordHash,
    role: 'owner',
    farm_id: farm.id,
  });

  const jack = manager.create(User, {
    name: 'Jack Briggs',
    email: 'jack@riverdale.com',
    password_hash: passwordHash,
    role: 'staff',
    farm_id: farm.id,
  });

  const sarah = manager.create(User, {
    name: 'Sarah Ohlsson',
    email: 'sarah@riverdale.com',
    password_hash: passwordHash,
    role: 'staff',
    farm_id: farm.id,
  });

  const priya = manager.create(User, {
    name: 'Dr. Priya Nair',
    email: 'priya@agronomy.com',
    password_hash: passwordHash,
    role: 'agronomist',
    farm_id: farm.id,
  });

  const elders = manager.create(User, {
    name: 'Elders Rural',
    email: 'orders@elders.com.au',
    password_hash: passwordHash,
    role: 'supplier',
    farm_id: farm.id,
  });

  await manager.save([owner, jack, sarah, priya, elders]);

  // 3. Create Paddocks
  const northFlat = manager.create(Paddock, {
    farm_id: farm.id,
    name: 'North Flat',
    land_area: 180,
    crop_type: 'Wheat',
  });

  const southCreek = manager.create(Paddock, {
    farm_id: farm.id,
    name: 'South Creek',
    land_area: 220,
    crop_type: 'Canola',
  });

  const eastBlock = manager.create(Paddock, {
    farm_id: farm.id,
    name: 'East Block',
    land_area: 150,
    crop_type: 'Fallow',
  });

  const westernPaddock = manager.create(Paddock, {
    farm_id: farm.id,
    name: 'Western Paddock',
    land_area: 200,
    crop_type: 'Barley',
  });

  await manager.save([northFlat, southCreek, eastBlock, westernPaddock]);

  // 4. Livestock Master Data
  const cattle = manager.create(Species, { name: 'Cattle', weight_unit: 'kg' });
  const sheep = manager.create(Species, { name: 'Sheep', weight_unit: 'kg' });
  await manager.save([cattle, sheep]);

  const angus = manager.create(Breed, { 
    species_id: cattle.id, 
    name: 'Angus', 
    purpose: 'meat' 
  });
  const merino = manager.create(Breed, { 
    species_id: sheep.id, 
    name: 'Merino', 
    purpose: 'wool' 
  });
  await manager.save([angus, merino]);

  // 5. Mobs
  const autumnSteers = manager.create(Mob, {
    name: 'Autumn Steers',
    farm_id: farm.id,
    species_id: cattle.id,
    breed_id: angus.id,
    head_count: 85,
    purchase_date: new Date('2026-03-15'),
    purchase_price_per_head: 1200,
    status: 'active',
  });

  const springEwes = manager.create(Mob, {
    name: 'Spring Ewes',
    farm_id: farm.id,
    species_id: sheep.id,
    breed_id: merino.id,
    head_count: 120,
    purchase_date: new Date('2026-04-01'),
    purchase_price_per_head: 280,
    status: 'active',
  });

  await manager.save([autumnSteers, springEwes]);

  // 6. Mob Assignments
  const steerAssign = manager.create(MobPaddockAssignment, {
    mob_id: autumnSteers.id,
    paddock_id: eastBlock.id,
    entry_date: new Date('2026-03-20'),
    entry_head_count: 85,
  });

  const eweAssign = manager.create(MobPaddockAssignment, {
    mob_id: springEwes.id,
    paddock_id: westernPaddock.id,
    entry_date: new Date('2026-04-05'),
    entry_head_count: 120,
  });

  await manager.save([steerAssign, eweAssign]);

  // 7. Health Events
  const steerHealth = manager.create(HealthEvent, {
    mob_id: autumnSteers.id,
    event_type: 'treatment',
    date: new Date('2026-03-25'),
    product_used: 'Ivermectin',
    dose: '10ml',
    withholding_period_days: 28,
    whp_expiry_date: new Date('2026-04-22'),
    head_count_affected: 85,
    cost_amount: 450.00,
  });

  const eweHealth = manager.create(HealthEvent, {
    mob_id: springEwes.id,
    event_type: 'vaccination',
    date: new Date('2026-04-10'),
    product_used: '5-in-1',
    dose: '2ml',
    head_count_affected: 120,
    cost_amount: 180.00,
  });

  await manager.save([steerHealth, eweHealth]);

  // 8. Weigh Events
  const steerWeigh1 = manager.create(WeighEvent, {
    mob_id: autumnSteers.id,
    date: new Date('2026-03-25'),
    head_count_weighed: 85,
    average_weight_kg: 285,
  });

  const steerWeigh2 = manager.create(WeighEvent, {
    mob_id: autumnSteers.id,
    date: new Date('2026-04-20'),
    head_count_weighed: 85,
    average_weight_kg: 310,
    adg_since_last_kg: 0.86,
  });

  await manager.save([steerWeigh1, steerWeigh2]);

  // 9. Financial Transactions (3 Months)
  const transactions = [
    // Livestock Purchases
    manager.create(FinancialTransaction, {
      source: 'livestock',
      reference_id: autumnSteers.id,
      amount: 85 * 1200,
      created_at: new Date('2026-03-15'),
    }),
    manager.create(FinancialTransaction, {
      source: 'livestock',
      reference_id: springEwes.id,
      amount: 120 * 280,
      created_at: new Date('2026-04-01'),
    }),
    // Labour (Feb/Mar/Apr)
    manager.create(FinancialTransaction, {
      paddock_id: northFlat.id,
      source: 'labour',
      amount: 1250.00,
      created_at: new Date('2026-02-15'),
    }),
    manager.create(FinancialTransaction, {
      paddock_id: southCreek.id,
      source: 'labour',
      amount: 980.00,
      created_at: new Date('2026-03-10'),
    }),
    // Fuel
    manager.create(FinancialTransaction, {
      paddock_id: westernPaddock.id,
      source: 'fuel',
      amount: 450.00,
      created_at: new Date('2026-04-12'),
    }),
    // Supplier
    manager.create(FinancialTransaction, {
      paddock_id: southCreek.id,
      source: 'supplier',
      amount: 2200.00,
      created_at: new Date('2026-03-05'),
    }),
  ];
  await manager.save(transactions);

  // 10. Agronomy Recommendations
  const recs = [
    manager.create(Recommendation, {
      paddock_id: northFlat.id,
      agronomist_id: priya.id,
      type: 'Fertiliser',
      description: 'Apply Nitrogen (Urea) at 100kg/ha before next rainfall event.',
      status: 'approved',
    }),
    manager.create(Recommendation, {
      paddock_id: southCreek.id,
      agronomist_id: priya.id,
      type: 'Spray',
      description: 'Selective herbicide for broadleaf control.',
      status: 'approved',
    }),
    manager.create(Recommendation, {
      paddock_id: westernPaddock.id,
      agronomist_id: priya.id,
      type: 'Soil Test',
      description: 'Deep core soil testing for nutrient profiling.',
      status: 'draft',
    }),
  ];
  await manager.save(recs);

  // 11. Supplier Orders
  const order = manager.create(SupplierOrder, {
    paddock_id: northFlat.id,
    supplier_id: elders.id,
    product_name: 'Urea',
    quantity: 18,
    unit_price: 850,
    status: 'ordered',
  });
  await manager.save(order);

  console.log('✅ Pilot Seed Complete for Riverdale Station.');
}
