/**
 * Volleyball Team Optimization Example
 *
 * Demonstrates using the Team Optimizer with a real volleyball configuration
 * and realistic player data.
 */

import { TeamOptimizerService } from '../src/index.js';
import volleyballConfig from './configs/volleyball.js';

// Sample volleyball players with realistic ratings
const players = [
    // Middle Blockers
    { id: 1, name: 'Smith', positions: ['MB'], ratings: { MB: 1850 } },
    { id: 2, name: 'Johnson', positions: ['MB'], ratings: { MB: 1800 } },
    { id: 3, name: 'Williams', positions: ['MB'], ratings: { MB: 1750 } },
    { id: 4, name: 'Brown', positions: ['MB'], ratings: { MB: 1700 } },

    // Setters
    { id: 5, name: 'Davis', positions: ['S'], ratings: { S: 1900 } },
    { id: 6, name: 'Miller', positions: ['S'], ratings: { S: 1750 } },

    // Liberos
    { id: 7, name: 'Garcia', positions: ['L'], ratings: { L: 1800 } },
    { id: 8, name: 'Rodriguez', positions: ['L'], ratings: { L: 1700 } },

    // Opposites
    { id: 9, name: 'Martinez', positions: ['OPP'], ratings: { OPP: 1850 } },
    { id: 10, name: 'Hernandez', positions: ['OPP'], ratings: { OPP: 1750 } },

    // Outside Hitters
    { id: 11, name: 'Lopez', positions: ['OH'], ratings: { OH: 1900 } },
    { id: 12, name: 'Gonzalez', positions: ['OH'], ratings: { OH: 1850 } },
    { id: 13, name: 'Wilson', positions: ['OH'], ratings: { OH: 1800 } },
    { id: 14, name: 'Anderson', positions: ['OH'], ratings: { OH: 1750 } },

    // Multi-position players (can play multiple positions)
    { id: 15, name: 'Taylor', positions: ['OH', 'OPP'], ratings: { OH: 1700, OPP: 1680 } },
    { id: 16, name: 'Thomas', positions: ['MB', 'OH'], ratings: { MB: 1650, OH: 1700 } }
];

async function optimizeVolleyballTeams() {
    console.log('=== Volleyball Team Optimizer ===\n');

    // Create optimizer with volleyball configuration
    const optimizer = new TeamOptimizerService(volleyballConfig);

    try {
        console.log('Configuration:');
        console.log(`  Sport: ${volleyballConfig.name}`);
        console.log(`  Players: ${players.length}`);
        console.log(`  Teams to create: 2`);
        console.log(`  Composition: ${JSON.stringify(volleyballConfig.defaultComposition)}\n`);

        // Run optimization
        const result = await optimizer.optimize(
            volleyballConfig.defaultComposition,
            2,
            players
        );

        console.log('✅ Optimization Complete!\n');

        // Results summary
        console.log('=== Results Summary ===');
        console.log(`Algorithm: ${result.algorithm}`);
        console.log(`Team balance difference: ${result.balance.difference.toFixed(2)} points`);
        console.log(`Standard deviation: ${result.balance.standardDeviation.toFixed(2)}`);
        console.log(`Average team strength: ${result.balance.average.toFixed(2)}\n`);

        // Display teams
        result.teams.forEach((team, idx) => {
            console.log(`\n=== Team ${idx + 1} ===`);
            console.log(`Overall Strength: ${result.balance.teamStrengths[idx].toFixed(2)}`);
            console.log('\nRoster:');

            // Group by position for better display
            const positionGroups = {};
            team.forEach(player => {
                const pos = player.assignedPosition;
                if (!positionGroups[pos]) {
                    positionGroups[pos] = [];
                }
                positionGroups[pos].push(player);
            });

            // Display in position order
            volleyballConfig.positionOrder.forEach(position => {
                if (positionGroups[position]) {
                    const fullName = volleyballConfig.positions[position];
                    console.log(`\n  ${fullName}s (${position}):`);
                    positionGroups[position].forEach(player => {
                        console.log(`    - ${player.name} (rating: ${player.positionRating})`);
                    });
                }
            });
        });

        // Display unused players
        if (result.unusedPlayers.length > 0) {
            console.log('\n=== Bench Players ===');
            result.unusedPlayers.forEach(player => {
                const positions = player.positions.join('/');
                const ratings = player.positions.map(pos => player.ratings[pos]).join('/');
                console.log(`  - ${player.name} (${positions}): ${ratings}`);
            });
        } else {
            console.log('\n✅ All players assigned to teams');
        }

        // Display validation info
        console.log('\n=== Validation ===');
        if (result.validation.warnings && result.validation.warnings.length > 0) {
            console.log('Warnings:');
            result.validation.warnings.forEach(warning => {
                console.log(`  ⚠️  ${warning.message}`);
            });
        } else {
            console.log('✅ No issues detected');
        }

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (error.stack) {
            console.error(error.stack);
        }
    }
}

optimizeVolleyballTeams();
