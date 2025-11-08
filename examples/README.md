# Team Optimizer Examples

This directory contains examples demonstrating how to use the Team Optimizer library for various sports and scenarios.

## 📁 Directory Structure

```
examples/
├── configs/              # Sample sport configurations
│   ├── volleyball.js     # Volleyball configuration
│   ├── basketball.js     # Basketball configuration
│   └── football.js       # Football/Soccer configuration
├── basic-usage.js        # Simple getting-started example
├── volleyball-example.js # Complete volleyball team optimization
└── custom-sport.js       # Creating a custom sport (Quidditch)
```

## 🚀 Running Examples

All examples can be run directly with Node.js:

```bash
# Basic usage
node examples/basic-usage.js

# Volleyball example
node examples/volleyball-example.js

# Custom sport (Quidditch)
node examples/custom-sport.js
```

## 📚 Example Descriptions

### 1. Basic Usage (`basic-usage.js`)

**Perfect for:** First-time users
**Demonstrates:**
- Creating a simple sport configuration (5-a-side soccer)
- Defining players with positions and ratings
- Running basic optimization
- Interpreting results

**Key concepts:**
```javascript
import { TeamOptimizerService } from 'team-optimizer';

const config = { /* sport configuration */ };
const optimizer = new TeamOptimizerService(config);
const result = await optimizer.optimize(composition, teamCount, players);
```

### 2. Volleyball Example (`volleyball-example.js`)

**Perfect for:** Real-world scenarios
**Demonstrates:**
- Using a complete sport configuration
- Handling multiple positions
- Working with multi-position players
- Detailed result analysis
- Professional output formatting

**Key features:**
- 6 different positions (MB, S, L, OPP, OH)
- Position weights for balanced teams
- Realistic player ratings
- Comprehensive result display

### 3. Custom Sport (`custom-sport.js`)

**Perfect for:** Creating your own sport configurations
**Demonstrates:**
- Defining a completely custom sport (Quidditch)
- Custom position names and codes
- Adjusting position weights for game importance
- Creating multiple teams (4 in this example)
- Creative result presentation

**Use this as a template for:**
- Creating configurations for niche sports
- Adapting the library for non-sport team balancing
- Understanding position weight impact

## 📖 Configuration Files

The `configs/` directory contains ready-to-use configurations for popular sports:

### Volleyball (`configs/volleyball.js`)
- 7 players per team
- 5 positions: MB, S, L, OPP, OH
- Position-weighted balancing

### Basketball (`configs/basketball.js`)
- 5 players per team
- 5 positions: PG, SG, SF, PF, C
- Emphasis on PG and C positions

### Football/Soccer (`configs/football.js`)
- 11 players per team
- 4 position groups: GK, DEF, MID, FWD
- Critical goalkeeper position weight

## 💡 Creating Your Own Config

1. **Copy a template:**
   ```bash
   cp examples/configs/volleyball.js examples/configs/my-sport.js
   ```

2. **Modify the structure:**
   ```javascript
   export default {
       name: 'My Sport',
       positions: { /* ... */ },
       positionOrder: [ /* ... */ ],
       defaultComposition: { /* ... */ },
       positionWeights: { /* ... */ }
   };
   ```

3. **Test it:**
   ```javascript
   import myConfig from './configs/my-sport.js';
   const optimizer = new TeamOptimizerService(myConfig);
   ```

## 📝 Player Data Format

All examples use the same player data structure:

```javascript
const player = {
    id: 1,                           // Unique identifier
    name: 'Player Name',             // Display name
    positions: ['POS1', 'POS2'],     // Array of positions they can play
    ratings: {                       // Rating for each position
        POS1: 1800,
        POS2: 1750
    }
};
```

**Important notes:**
- `positions` array: All positions the player can play
- `ratings` object: Separate rating for each position
- Multi-position players: Can be assigned to any of their positions
- Rating scale: Typically 1000-2000 (like ELO ratings)

## 🎯 Common Use Cases

### Balancing Recreational Teams
Use `basic-usage.js` as a starting point. Focus on:
- Simple position structures
- Equal position weights
- Smaller team sizes

### Competitive League Teams
Use `volleyball-example.js` as a template. Features:
- Detailed position roles
- Weighted positions
- Large player pools
- Multi-position versatility

### Custom Scenarios
Use `custom-sport.js` for inspiration. Examples:
- E-sports team composition
- Work project team balancing
- Tournament bracket seeding
- Academic group assignments

## 🔧 Advanced Usage

### Custom Evaluation Functions

Override the default evaluation logic:

```javascript
function customEvaluate(teams, service) {
    // Your custom balancing logic
    let score = 0;

    // Example: Heavily penalize teams with weak defenders
    teams.forEach(team => {
        const defenders = team.filter(p => p.assignedPosition === 'DEF');
        const avgDefRating = defenders.reduce((s, p) => s + p.positionRating, 0) / defenders.length;
        if (avgDefRating < 1700) {
            score += 1000; // Heavy penalty
        }
    });

    return score;
}

const optimizer = new TeamOptimizerService(config, customEvaluate);
```

### Accessing Individual Services

The library exports individual services for advanced use:

```javascript
import {
    ValidationService,
    EvaluationService,
    SolutionOrganizer
} from 'team-optimizer';

// Use services independently
const validator = new ValidationService(config);
const validation = validator.validate(composition, teamCount, players);
```

## 📚 Further Reading

- [CONFIG_SCHEMA.md](../CONFIG_SCHEMA.md) - Complete configuration reference
- [README.md](../README.md) - Main library documentation
- Source code in `src/` - For implementation details

## 💬 Questions?

- Check the main README for troubleshooting
- Review CONFIG_SCHEMA.md for configuration details
- Examine the source code for advanced features

## 🤝 Contributing Examples

Have a great example? Contributions are welcome! Make sure your example:
- Is well-commented
- Includes realistic data
- Demonstrates a clear use case
- Follows the existing code style
