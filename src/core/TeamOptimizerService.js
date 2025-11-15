// Team Optimizer Service - Universal team balancing for any activity
// Orchestrates multiple optimization algorithms and manages the optimization lifecycle

import GeneticAlgorithmOptimizer from '../algorithms/GeneticAlgorithmOptimizer.js';
import TabuSearchOptimizer from '../algorithms/TabuSearchOptimizer.js';
import SimulatedAnnealingOptimizer from '../algorithms/SimulatedAnnealingOptimizer.js';
import AntColonyOptimizer from '../algorithms/AntColonyOptimizer.js';
import ConstraintProgrammingOptimizer from '../algorithms/ConstraintProgrammingOptimizer.js';
import LocalSearchOptimizer from '../algorithms/LocalSearchOptimizer.js';
import HybridOptimizer from '../algorithms/HybridOptimizer.js';

import { generateInitialSolutions } from '../utils/solutionGenerators.js';
import { getTeamSize } from '../utils/configHelpers.js';
import { calculateTeamBalance } from '../utils/evaluationUtils.js';

import ValidationService from '../services/ValidationService.js';
import EvaluationService from '../services/EvaluationService.js';
import SolutionOrganizer from '../services/SolutionOrganizer.js';

class TeamOptimizerService {
    /**
     * @param {Object} activityConfig - Activity-specific configuration
     * @param {Function} customEvaluationFn - Optional custom evaluation function for team strength
     */
    constructor(activityConfig, customEvaluationFn = null) {
        // Initialize services
        this.validationService = new ValidationService(activityConfig);

        // Validate activity configuration
        if (!this.validationService.validateActivityConfig(activityConfig)) {
            throw new Error('Invalid activity configuration');
        }

        this.activityConfig = activityConfig;

        // Calculate team size from composition
        this.teamSize = getTeamSize(activityConfig.defaultComposition);

        console.log(`Initialized ${activityConfig.name || 'Team'} Optimizer (${this.teamSize} players per team)`);

        // Main configuration - which algorithms to use
        this.config = {
            useGeneticAlgorithm: true,
            useTabuSearch: true,
            useSimulatedAnnealing: true,
            useAntColony: true,
            useConstraintProgramming: true,
            useHybridOptimizer: true,  // New hybrid algorithm
            adaptiveSwapEnabled: true,
            adaptiveParameters: {
                strongWeakSwapProbability: 0.6,
                positionBalanceWeight: 0.3,
                varianceWeight: 0.5,

                // Advanced metrics weights
                fairnessWeight: 0.4,
                consistencyWeight: 0.3,
                depthWeight: 0.1,
                roleBalanceWeight: 0.2,
                useAdvancedMetrics: true,
                topPlayerPercent: 0.2,

                positionWeights: activityConfig.positionWeights  // Add position weights from config
            }
        };

        // Initialize evaluation and organization services
        this.evaluationService = new EvaluationService(
            activityConfig,
            this.config.adaptiveParameters,
            customEvaluationFn
        );
        this.solutionOrganizer = new SolutionOrganizer(activityConfig);

        // Algorithm-specific configurations
        // Optimized parameters based on analysis and performance testing
        this.algorithmConfigs = {
            geneticAlgorithm: {
                populationSize: 25,           // Increased for better diversity
                generationCount: 350,         // More generations for convergence
                mutationRate: 0.25,           // Increased mutation rate
                crossoverRate: 0.75,          // Higher crossover rate
                elitismCount: 3,              // Keep top 3 solutions
                tournamentSize: 3,
                maxStagnation: 25             // More patience before diversity injection
            },
            tabuSearch: {
                tabuTenure: 120,              // Increased tenure for better memory
                iterations: 12000,            // More iterations
                neighborCount: 25,            // Larger neighborhood
                diversificationFrequency: 1200 // Aligned with iterations
            },
            simulatedAnnealing: {
                initialTemperature: 1500,     // Higher initial temp for more exploration
                coolingRate: 0.9965,          // Slower cooling for better convergence
                iterations: 120000,           // More iterations
                reheatEnabled: true,
                reheatTemperature: 700,       // Higher reheat temperature
                reheatIterations: 25000       // More iterations before reheat
            },
            antColony: {
                antCount: 25,                 // More ants for better exploration
                iterations: 350,              // More iterations
                alpha: 1.0,
                beta: 2.5,                    // Increased heuristic influence
                evaporationRate: 0.12,        // Slightly faster evaporation
                pheromoneDeposit: 120,        // More pheromone
                elitistWeight: 2.5            // Stronger elitism
            },
            constraintProgramming: {
                maxBacktracks: 12000,         // More backtracking allowed
                variableOrderingHeuristic: 'most-constrained',
                valueOrderingHeuristic: 'least-constraining',
                propagationLevel: 'full',
                restartStrategy: 'luby',
                conflictAnalysis: true
            },
            localSearch: {
                iterations: 4000,             // More iterations for thorough search
                neighborhoodSize: 12          // Larger neighborhood
            },
            hybrid: {
                phase1: {                     // Genetic Algorithm phase
                    populationSize: 20,       // Larger population
                    generations: 120,         // More generations
                    mutationRate: 0.35,       // Higher mutation for exploration
                    crossoverRate: 0.75,      // Higher crossover
                    elitismCount: 3,          // Keep top 3
                    tournamentSize: 3
                },
                phase2: {                     // Tabu Search phase
                    iterations: 4000,         // More iterations
                    tabuTenure: 60,           // Larger tenure
                    neighborhoodSize: 18,     // Larger neighborhood
                    diversificationFrequency: 600
                },
                phase3: {                     // Local Search phase
                    iterations: 1500,         // More iterations
                    neighborhoodSize: 12      // Larger neighborhood
                }
            }
        };

        this.algorithmStats = {};
    }

    /**
     * Main optimization entry point
     * @param {Object} composition - Position composition requirements
     * @param {number} teamCount - Number of teams to create
     * @param {Array} players - Available players
     * @returns {Promise<Object>} Optimization result
     */
    async optimize(composition, teamCount, players) {
        // Validate input using ValidationService
        const validation = this.validationService.validate(composition, teamCount, players);
        if (!validation.isValid) {
            throw new Error(validation.errors.map(e => e.message).join(', '));
        }

        // Prepare data using SolutionOrganizer
        this.adaptParameters(teamCount, players.length);
        const playersByPosition = this.solutionOrganizer.groupByPosition(players);
        const positions = Object.keys(composition).filter(pos => composition[pos] > 0);

        // Set composition in EvaluationService for advanced metrics
        this.evaluationService.setComposition(composition);

        // Generate initial solutions
        const initialSolutions = generateInitialSolutions(composition, teamCount, playersByPosition);
        this.resetAlgorithmStats();

        // Create problem context that will be passed to all optimizers
        const problemContext = {
            composition,
            teamCount,
            playersByPosition,
            positions,
            evaluateFn: (teams) => this.evaluationService.evaluateSolution(teams)
        };

        // Run algorithms in parallel
        const { results, algorithmNames } = await this.runOptimizationAlgorithms(
            initialSolutions,
            problemContext
        );

        // Select best result based on score (lower is better)
        const scores = results.map(r => this.evaluationService.evaluateSolution(r));
        const bestIdx = scores.indexOf(Math.min(...scores));

        // Log algorithm performance for debugging
        console.log('=== Algorithm Performance ===');
        algorithmNames.forEach((name, idx) => {
            console.log(`${name}: score ${scores[idx].toFixed(2)}`);
        });
        console.log(`Best result from: ${algorithmNames[bestIdx]} (score: ${scores[bestIdx].toFixed(2)})`);
        console.log('============================');

        // Refine with local search
        const localSearchContext = {
            ...problemContext,
            initialSolution: results[bestIdx]
        };
        const localSearchOptimizer = new LocalSearchOptimizer(
            this.algorithmConfigs.localSearch,
            this.config.adaptiveParameters
        );
        const bestTeams = await localSearchOptimizer.solve(localSearchContext);
        this.algorithmStats.localSearch = localSearchOptimizer.getStatistics();

        // Organize final solution using SolutionOrganizer
        const { teams, unusedPlayers } = this.solutionOrganizer.prepareFinalSolution(bestTeams, players);

        const balance = this.evaluateBalance(teams);

        return {
            teams,
            balance,
            unusedPlayers,
            validation,
            algorithm: `${algorithmNames[bestIdx]} + Local Search Refinement`,
            statistics: this.getAlgorithmStatistics()
        };
    }

    /**
     * Calculate team strength using activity-specific position weights
     * @param {Array} team - Team to evaluate
     * @returns {number} Team strength
     */
    calculateTeamStrength(team) {
        return calculateSimpleTeamStrength(team, this.activityConfig.positionWeights);
    }

    /**
     * Evaluate balance of multiple teams
     * @param {Array} teams - Teams to evaluate
     * @returns {Object} Balance metrics
     */
    evaluateBalance(teams) {
        return calculateTeamBalance(teams, this.activityConfig.positionWeights);
    }

    /**
     * Evaluate solution quality (lower is better)
     * @param {Array} teams - Teams to evaluate
     * @returns {number} Quality score (lower is better)
     */
    evaluateSolution(teams) {
        return this.evaluationService.evaluateSolution(teams);
    }

    /**
     * Run all enabled optimization algorithms in parallel
     * Each algorithm now starts from a randomly selected initial solution for diversity
     * @param {Array} initialSolutions - Initial candidate solutions
     * @param {Object} problemContext - Problem context
     * @returns {Promise<Object>} Results and algorithm names
     */
    async runOptimizationAlgorithms(initialSolutions, problemContext) {
        const algorithmPromises = [];
        const algorithmNames = [];

        // Helper to get a random initial solution
        const getRandomInitialSolution = () => {
            return initialSolutions[Math.floor(Math.random() * initialSolutions.length)];
        };

        // Genetic Algorithm - uses entire population
        if (this.config.useGeneticAlgorithm) {
            const optimizer = new GeneticAlgorithmOptimizer(
                this.algorithmConfigs.geneticAlgorithm,
                this.config.adaptiveParameters
            );
            const context = { ...problemContext, initialSolution: initialSolutions };
            algorithmPromises.push(
                optimizer.solve(context).then(result => {
                    this.algorithmStats.geneticAlgorithm = optimizer.getStatistics();
                    return result;
                })
            );
            algorithmNames.push('Genetic Algorithm');
        }

        // Tabu Search (Multi-Start with random starting points)
        if (this.config.useTabuSearch) {
            const startCount = Math.min(3, initialSolutions.length);
            const tabuResults = [];

            for (let i = 0; i < startCount; i++) {
                const optimizer = new TabuSearchOptimizer(
                    this.algorithmConfigs.tabuSearch,
                    this.config.adaptiveParameters
                );
                // Each run starts from a different random solution
                const context = { ...problemContext, initialSolution: getRandomInitialSolution() };
                tabuResults.push(optimizer.solve(context));
            }

            algorithmPromises.push(
                Promise.all(tabuResults).then(results => {
                    const scores = results.map(r => this.evaluationService.evaluateSolution(r));
                    const bestIdx = scores.indexOf(Math.min(...scores));
                    this.algorithmStats.tabuSearch = { iterations: startCount * this.algorithmConfigs.tabuSearch.iterations, improvements: 0 };
                    return results[bestIdx];
                })
            );
            algorithmNames.push('Tabu Search');
        }

        // Simulated Annealing - now uses random initial solution
        if (this.config.useSimulatedAnnealing) {
            const optimizer = new SimulatedAnnealingOptimizer(
                this.algorithmConfigs.simulatedAnnealing,
                this.config.adaptiveParameters
            );
            // Use random starting point for diversity
            const context = { ...problemContext, initialSolution: getRandomInitialSolution() };
            algorithmPromises.push(
                optimizer.solve(context).then(result => {
                    this.algorithmStats.simulatedAnnealing = optimizer.getStatistics();
                    return result;
                })
            );
            algorithmNames.push('Simulated Annealing');
        }

        // Ant Colony Optimization - constructs solutions from scratch (inherently diverse)
        if (this.config.useAntColony) {
            const optimizer = new AntColonyOptimizer(this.algorithmConfigs.antColony);
            algorithmPromises.push(
                optimizer.solve(problemContext).then(result => {
                    this.algorithmStats.antColony = optimizer.getStatistics();
                    return result;
                })
            );
            algorithmNames.push('Ant Colony Optimization');
        }

        // Constraint Programming - constructs solutions from scratch (inherently diverse)
        if (this.config.useConstraintProgramming) {
            const optimizer = new ConstraintProgrammingOptimizer(this.algorithmConfigs.constraintProgramming);
            algorithmPromises.push(
                optimizer.solve(problemContext).then(result => {
                    this.algorithmStats.constraintProgramming = optimizer.getStatistics();
                    return result;
                })
            );
            algorithmNames.push('Constraint Programming');
        }

        // Hybrid Optimizer - combines GA, Tabu Search, and Local Search
        if (this.config.useHybridOptimizer) {
            const optimizer = new HybridOptimizer(
                this.algorithmConfigs.hybrid,
                this.config.adaptiveParameters
            );
            // Use random starting point for diversity
            const context = { ...problemContext, initialSolution: getRandomInitialSolution() };
            algorithmPromises.push(
                optimizer.solve(context).then(result => {
                    this.algorithmStats.hybrid = optimizer.getStatistics();
                    return result;
                })
            );
            algorithmNames.push('Hybrid Optimizer');
        }

        // Fallback: if no algorithms enabled, enable defaults
        if (algorithmPromises.length === 0) {
            this.config.useGeneticAlgorithm = true;
            this.config.useTabuSearch = true;
            return this.runOptimizationAlgorithms(initialSolutions, problemContext);
        }

        // Use Promise.allSettled to handle individual algorithm failures gracefully
        const settledResults = await Promise.allSettled(algorithmPromises);

        // Filter out rejected promises and log failures
        const results = [];
        const successfulAlgorithmNames = [];
        settledResults.forEach((result, idx) => {
            if (result.status === 'fulfilled') {
                results.push(result.value);
                successfulAlgorithmNames.push(algorithmNames[idx]);
            } else {
                console.error(`Algorithm ${algorithmNames[idx]} failed:`, result.reason);
            }
        });

        // Ensure we have at least one result
        if (results.length === 0) {
            console.warn('All algorithms failed, using first initial solution');
            return {
                results: [initialSolutions[0]],
                algorithmNames: ['Fallback (Initial Solution)']
            };
        }

        return { results, algorithmNames: successfulAlgorithmNames };
    }

    /**
     * Adapt parameters based on problem size (placeholder for future enhancements)
     * @param {number} teamCount - Number of teams
     * @param {number} totalPlayers - Total number of players
     */
    adaptParameters(teamCount, totalPlayers) {
        // Future: dynamically adjust algorithm parameters based on problem size
    }

    /**
     * Reset algorithm statistics
     */
    resetAlgorithmStats() {
        this.algorithmStats = {
            geneticAlgorithm: { generations: 0, improvements: 0 },
            tabuSearch: { iterations: 0, improvements: 0 },
            simulatedAnnealing: { iterations: 0, improvements: 0, temperature: 0 },
            antColony: { iterations: 0, improvements: 0 },
            constraintProgramming: { iterations: 0, improvements: 0, backtracks: 0, conflicts: 0 },
            localSearch: { iterations: 0, improvements: 0 },
            hybrid: { totalIterations: 0, totalImprovements: 0, bestPhase: null }
        };
    }

    /**
     * Get algorithm statistics
     * @returns {Object} Statistics for all algorithms
     */
    getAlgorithmStatistics() {
        return this.algorithmStats;
    }
}

export default TeamOptimizerService;
