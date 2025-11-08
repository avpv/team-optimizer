/**
 * Custom Activity Configuration Example
 *
 * This example shows how to create a completely custom activity configuration
 * for a fictional sport called "Quidditch" (inspired by Harry Potter)
 */

import { TeamOptimizerService } from '../src/index.js';

// Define a custom activity: Quidditch
const quidditchConfig = {
    name: 'Quidditch',

    // Position definitions
    positions: {
        SEEK: 'Seeker',
        KEEP: 'Keeper',
        CHAS: 'Chaser',
        BEAT: 'Beater'
    },

    // Display order
    positionOrder: ['SEEK', 'KEEP', 'CHAS', 'BEAT'],

    // Team composition: 7 players per team
    defaultComposition: {
        SEEK: 1,   // 1 Seeker (catches the Golden Snitch)
        KEEP: 1,   // 1 Keeper (defends the goal hoops)
        CHAS: 3,   // 3 Chasers (score with Quaffle)
        BEAT: 2    // 2 Beaters (defend with Bludgers)
    },

    // Position importance weights
    positionWeights: {
        SEEK: 1.3,  // Seeker is very important (game-ending role)
        KEEP: 1.1,  // Keeper important for defense
        CHAS: 1.0,  // Chasers normal importance
        BEAT: 0.9   // Beaters slightly less critical
    }
};

// Define players from different Hogwarts houses
const players = [
    // Seekers
    { id: 1, name: 'Harry Potter', positions: ['SEEK'], ratings: { SEEK: 1950 } },
    { id: 2, name: 'Draco Malfoy', positions: ['SEEK'], ratings: { SEEK: 1850 } },
    { id: 3, name: 'Cho Chang', positions: ['SEEK'], ratings: { SEEK: 1800 } },
    { id: 4, name: 'Cedric Diggory', positions: ['SEEK'], ratings: { SEEK: 1900 } },

    // Keepers
    { id: 5, name: 'Oliver Wood', positions: ['KEEP'], ratings: { KEEP: 1900 } },
    { id: 6, name: 'Ron Weasley', positions: ['KEEP'], ratings: { KEEP: 1700 } },
    { id: 7, name: 'Cormac McLaggen', positions: ['KEEP'], ratings: { KEEP: 1750 } },
    { id: 8, name: 'Miles Bletchley', positions: ['KEEP'], ratings: { KEEP: 1800 } },

    // Chasers
    { id: 9, name: 'Angelina Johnson', positions: ['CHAS'], ratings: { CHAS: 1850 } },
    { id: 10, name: 'Katie Bell', positions: ['CHAS'], ratings: { CHAS: 1800 } },
    { id: 11, name: 'Alicia Spinnet', positions: ['CHAS'], ratings: { CHAS: 1750 } },
    { id: 12, name: 'Adrian Pucey', positions: ['CHAS'], ratings: { CHAS: 1780 } },
    { id: 13, name: 'Marcus Flint', positions: ['CHAS'], ratings: { CHAS: 1820 } },
    { id: 14, name: 'Graham Montague', positions: ['CHAS'], ratings: { CHAS: 1770 } },
    { id: 15, name: 'Roger Davies', positions: ['CHAS'], ratings: { CHAS: 1790 } },
    { id: 16, name: 'Zacharias Smith', positions: ['CHAS'], ratings: { CHAS: 1740 } },
    { id: 17, name: 'Demelza Robins', positions: ['CHAS'], ratings: { CHAS: 1760 } },
    { id: 18, name: 'Ginny Weasley', positions: ['CHAS'], ratings: { CHAS: 1830 } },

    // Beaters
    { id: 19, name: 'Fred Weasley', positions: ['BEAT'], ratings: { BEAT: 1850 } },
    { id: 20, name: 'George Weasley', positions: ['BEAT'], ratings: { BEAT: 1850 } },
    { id: 21, name: 'Lucian Bole', positions: ['BEAT'], ratings: { BEAT: 1780 } },
    { id: 22, name: 'Peregrine Derrick', positions: ['BEAT'], ratings: { BEAT: 1760 } },
    { id: 23, name: 'Ritchie Coote', positions: ['BEAT'], ratings: { BEAT: 1720 } },
    { id: 24, name: 'Jimmy Peakes', positions: ['BEAT'], ratings: { BEAT: 1700 } },

    // Multi-position versatile players
    { id: 25, name: 'Hermione Granger', positions: ['CHAS', 'BEAT'], ratings: { CHAS: 1650, BEAT: 1680 } },
    { id: 26, name: 'Neville Longbottom', positions: ['BEAT', 'KEEP'], ratings: { BEAT: 1650, KEEP: 1620 } },

    // Additional players to fill out 4 teams
    { id: 27, name: 'Dean Thomas', positions: ['CHAS'], ratings: { CHAS: 1720 } },
    { id: 28, name: 'Seamus Finnigan', positions: ['CHAS'], ratings: { CHAS: 1710 } },
    { id: 29, name: 'Anthony Goldstein', positions: ['BEAT'], ratings: { BEAT: 1730 } },
    { id: 30, name: 'Michael Corner', positions: ['BEAT'], ratings: { BEAT: 1710 } }
];

async function optimizeQuidditchTeams() {
    console.log('⚡ Quidditch Team Optimizer ⚡\n');
    console.log('Creating balanced teams for Hogwarts Inter-House Championship\n');

    const optimizer = new TeamOptimizerService(quidditchConfig);

    try {
        // Create 4 teams (one for each house)
        const teamCount = 4;

        console.log('Configuration:');
        console.log(`  Activity: ${quidditchConfig.name}`);
        console.log(`  Players available: ${players.length}`);
        console.log(`  Teams to create: ${teamCount} (Gryffindor, Slytherin, Ravenclaw, Hufflepuff)`);
        console.log(`  Players per team: 7`);
        console.log(`  Composition: 1 Seeker, 1 Keeper, 3 Chasers, 2 Beaters\n`);

        const result = await optimizer.optimize(
            quidditchConfig.defaultComposition,
            teamCount,
            players
        );

        console.log('✨ Teams Created Successfully! ✨\n');

        // Assign house names to teams
        const houseNames = ['Gryffindor', 'Slytherin', 'Ravenclaw', 'Hufflepuff'];
        const houseColors = ['🔴', '🟢', '🔵', '🟡'];

        // Display results
        console.log('=== Results ===');
        console.log(`Balance difference: ${result.balance.difference.toFixed(2)} points`);
        console.log(`Standard deviation: ${result.balance.standardDeviation.toFixed(2)}`);
        console.log(`Algorithm: ${result.algorithm}\n`);

        // Display each team
        result.teams.forEach((team, idx) => {
            const houseName = houseNames[idx] || `Team ${idx + 1}`;
            const houseColor = houseColors[idx] || '⚪';

            console.log(`\n${houseColor} === ${houseName.toUpperCase()} ===`);
            console.log(`Team Strength: ${result.balance.teamStrengths[idx].toFixed(2)}`);
            console.log('─'.repeat(50));

            // Group by position
            quidditchConfig.positionOrder.forEach(posCode => {
                const playersAtPos = team.filter(p => p.assignedPosition === posCode);
                if (playersAtPos.length > 0) {
                    const posName = quidditchConfig.positions[posCode];
                    console.log(`\n  ${posName}${playersAtPos.length > 1 ? 's' : ''}:`);
                    playersAtPos.forEach(player => {
                        console.log(`    ⭐ ${player.name} (${player.positionRating})`);
                    });
                }
            });
        });

        // Display unused players (reserves)
        if (result.unusedPlayers.length > 0) {
            console.log('\n\n🪑 === RESERVE PLAYERS ===');
            result.unusedPlayers.forEach(player => {
                const positions = player.positions.map(p => quidditchConfig.positions[p]).join(' / ');
                console.log(`  - ${player.name} (${positions})`);
            });
        }

        console.log('\n\n🏆 May the best team win! 🏆');

    } catch (error) {
        console.error('\n❌ Error creating teams:', error.message);
    }
}

optimizeQuidditchTeams();
