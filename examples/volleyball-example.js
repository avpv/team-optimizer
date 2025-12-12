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
    // Create optimizer with volleyball configuration
    const optimizer = new TeamOptimizerService(volleyballConfig);

    try {
        // Run optimization
        const result = await optimizer.optimize(
            volleyballConfig.defaultComposition,
            2,
            players
        );

        // Results summary
        // Display teams
        result.teams.forEach((team, idx) => {
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
                    positionGroups[position].forEach(player => {
                    });
                }
            });
        });

        // Display unused players
        if (result.unusedPlayers.length > 0) {
            result.unusedPlayers.forEach(player => {
                const positions = player.positions.join('/');
                const ratings = player.positions.map(pos => player.ratings[pos]).join('/');
            });
        } else {
        }

        // Display validation info
        if (result.validation.warnings && result.validation.warnings.length > 0) {
            result.validation.warnings.forEach(warning => {
            });
        } else {
        }

    } catch (error) {
        if (error.stack) {
        }
    }
}

optimizeVolleyballTeams();
