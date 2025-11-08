# Activity Configuration Schema

This document describes how to create activity configuration objects for the Team Optimizer library.

## Overview

Team Optimizer is activity-agnostic. You define the rules and positions for your activity by creating a configuration object that describes:
- What positions exist
- How many players per position per team
- How important each position is (weights)
- Display order preferences

## Configuration Object Structure

```javascript
const activityConfig = {
    name: string,              // Name of the activity (e.g., "Volleyball", "Project Teams")
    positions: object,         // Position/role codes and their full names
    positionOrder: array,      // Order for displaying positions
    defaultComposition: object,// Default number of people per position/role
    positionWeights: object    // Importance weight for each position (1.0 = normal)
};
```

## Required Fields

### 1. `name` (string)
The display name of your activity.

```javascript
name: "Volleyball"
```

### 2. `positions` (object)
Maps position/role codes to their full names. Position codes should be short (2-4 characters).

```javascript
positions: {
    MB: 'Middle Blocker',
    S: 'Setter',
    L: 'Libero',
    OPP: 'Opposite',
    OH: 'Outside Hitter'
}
```

### 3. `positionOrder` (array)
Defines the order in which positions should be displayed (e.g., in team listings).

```javascript
positionOrder: ['MB', 'S', 'L', 'OPP', 'OH']
```

### 4. `defaultComposition` (object)
Specifies how many players of each position are on a standard team.

```javascript
defaultComposition: {
    S: 1,    // 1 Setter
    OPP: 1,  // 1 Opposite
    OH: 2,   // 2 Outside Hitters
    MB: 2,   // 2 Middle Blockers
    L: 1     // 1 Libero
}
// Total: 7 players per team
```

### 5. `positionWeights` (object)
Defines the relative importance of each position in team balancing (1.0 = normal importance).

Higher weights mean the position has more impact on overall team strength.

```javascript
positionWeights: {
    MB: 1.1,   // Middle Blockers slightly more important
    S: 1.0,    // Setters normal importance
    L: 0.9,    // Liberos slightly less important
    OPP: 1.0,  // Opposites normal importance
    OH: 1.0    // Outside Hitters normal importance
}
```

**Guidelines for weights:**
- `1.0` = Normal importance (default)
- `> 1.0` = More important (algorithm will prioritize balancing this position)
- `< 1.0` = Less important
- Typical range: `0.8` to `1.3`

## Complete Examples

### Volleyball
```javascript
export default {
    name: 'Volleyball',
    positions: {
        MB: 'Middle Blocker',
        S: 'Setter',
        L: 'Libero',
        OPP: 'Opposite',
        OH: 'Outside Hitter'
    },
    positionOrder: ['MB', 'S', 'L', 'OPP', 'OH'],
    defaultComposition: {
        S: 1,
        OPP: 1,
        OH: 2,
        MB: 2,
        L: 1
    },
    positionWeights: {
        MB: 1.1,
        S: 1.0,
        L: 0.9,
        OPP: 1.0,
        OH: 1.0
    }
};
```

### Basketball
```javascript
export default {
    name: 'Basketball',
    positions: {
        PG: 'Point Guard',
        SG: 'Shooting Guard',
        SF: 'Small Forward',
        PF: 'Power Forward',
        C: 'Center'
    },
    positionOrder: ['PG', 'SG', 'SF', 'PF', 'C'],
    defaultComposition: {
        PG: 1,
        SG: 1,
        SF: 1,
        PF: 1,
        C: 1
    },
    positionWeights: {
        PG: 1.1,  // Point guard often critical
        SG: 1.0,
        SF: 1.0,
        PF: 1.0,
        C: 1.1    // Center often critical
    }
};
```

### Football (Soccer)
```javascript
export default {
    name: 'Football',
    positions: {
        GK: 'Goalkeeper',
        DEF: 'Defender',
        MID: 'Midfielder',
        FWD: 'Forward'
    },
    positionOrder: ['GK', 'DEF', 'MID', 'FWD'],
    defaultComposition: {
        GK: 1,
        DEF: 4,
        MID: 3,
        FWD: 3
    },
    positionWeights: {
        GK: 1.2,   // Goalkeeper very important
        DEF: 1.0,
        MID: 1.0,
        FWD: 1.1   // Forwards slightly more important
    }
};
```

## Usage

```javascript
import { TeamOptimizerService } from 'team-optimizer';

// Your custom sport config
const myConfig = {
    name: 'My Sport',
    positions: { /* ... */ },
    positionOrder: [ /* ... */ ],
    defaultComposition: { /* ... */ },
    positionWeights: { /* ... */ }
};

// Create optimizer with your config
const optimizer = new TeamOptimizerService(myConfig);
```

## Validation

The library will validate your configuration when you create a `TeamOptimizerService` instance. It checks:

1. All required fields are present
2. `positions` is a non-empty object
3. `positionOrder` is a non-empty array
4. `defaultComposition` is an object
5. `positionWeights` is an object

If validation fails, an error will be thrown with a descriptive message.

## Tips for Creating Configs

1. **Position Codes**: Use short, memorable codes (2-4 characters)
2. **Position Weights**: Start with all weights at 1.0, then adjust based on your activity's dynamics
3. **Composition**: Make sure the total people per team matches your activity's requirements
4. **Testing**: Test with small datasets first to validate your configuration

## Advanced: Custom Evaluation Functions

For more complex balancing logic, you can provide a custom evaluation function:

```javascript
function customEvaluate(teams, service) {
    // Your custom logic here
    // Return a score (lower is better)
    return score;
}

const optimizer = new TeamOptimizerService(myConfig, customEvaluate);
```

See the examples directory for more detailed usage patterns.
