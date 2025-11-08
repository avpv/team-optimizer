/**
 * Basic usage example for Team Optimizer
 *
 * This example demonstrates:
 * - Creating a custom activity configuration
 * - Defining players with positions and ratings
 * - Running the optimization
 * - Interpreting results
 */

import { TeamOptimizerService } from '../src/index.js';

// Step 1: Define your activity configuration
const miniSoccerConfig = {
    name: '5-a-side Soccer',
    positions: {
        GK: 'Goalkeeper',
        DEF: 'Defender',
        MID: 'Midfielder',
        FWD: 'Forward'
    },
    positionOrder: ['GK', 'DEF', 'MID', 'FWD'],
    defaultComposition: {
        GK: 1,   // 1 goalkeeper
        DEF: 1,  // 1 defender
        MID: 2,  // 2 midfielders
        FWD: 1   // 1 forward
    },
    positionWeights: {
        GK: 1.2,   // Goalkeeper is very important
        DEF: 1.0,
        MID: 1.0,
        FWD: 1.1   // Forward slightly more important
    }
};

// Step 2: Define your players
const players = [
    // Goalkeepers
    { id: 1, name: 'Alice', positions: ['GK'], ratings: { GK: 1800 } },
    { id: 2, name: 'Bob', positions: ['GK'], ratings: { GK: 1600 } },

    // Defenders
    { id: 3, name: 'Charlie', positions: ['DEF'], ratings: { DEF: 1750 } },
    { id: 4, name: 'Diana', positions: ['DEF'], ratings: { DEF: 1650 } },

    // Midfielders
    { id: 5, name: 'Eve', positions: ['MID'], ratings: { MID: 1800 } },
    { id: 6, name: 'Frank', positions: ['MID'], ratings: { MID: 1700 } },
    { id: 7, name: 'Grace', positions: ['MID'], ratings: { MID: 1650 } },
    { id: 8, name: 'Henry', positions: ['MID'], ratings: { MID: 1600 } },

    // Forwards
    { id: 9, name: 'Ivy', positions: ['FWD'], ratings: { FWD: 1850 } },
    { id: 10, name: 'Jack', positions: ['FWD'], ratings: { FWD: 1700 } }
];

// Step 3: Create the optimizer
const optimizer = new TeamOptimizerService(miniSoccerConfig);

// Step 4: Run the optimization
async function runOptimization() {
    try {
        console.log('Starting team optimization...\n');

        const result = await optimizer.optimize(
            miniSoccerConfig.defaultComposition,  // Use default composition
            2,                                      // Create 2 teams
            players                                 // With these players
        );

        console.log('✅ Optimization complete!\n');

        // Display results
        console.log(`Algorithm used: ${result.algorithm}`);
        console.log(`Teams created: ${result.teams.length}`);
        console.log(`Balance difference: ${result.balance.difference.toFixed(2)}`);
        console.log(`Standard deviation: ${result.balance.standardDeviation.toFixed(2)}\n`);

        // Display each team
        result.teams.forEach((team, index) => {
            console.log(`\n=== Team ${index + 1} ===`);
            console.log(`Strength: ${result.balance.teamStrengths[index].toFixed(2)}`);
            console.log('Players:');
            team.forEach(player => {
                console.log(`  - ${player.name} (${player.assignedPosition}): ${player.positionRating}`);
            });
        });

        // Display unused players (if any)
        if (result.unusedPlayers.length > 0) {
            console.log('\n=== Unused Players ===');
            result.unusedPlayers.forEach(player => {
                console.log(`  - ${player.name} (${player.positions.join(', ')})`);
            });
        }

    } catch (error) {
        console.error('❌ Optimization failed:', error.message);
    }
}

runOptimization();
