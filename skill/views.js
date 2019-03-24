'use strict';

/**
 * Define all the replies to the user
 * See more http://voxa.readthedocs.io/en/latest/views-and-variables.html#views
 */

const views = (function views() {
  return {
    Welcome: {
     ask: 'Welcome to Casino War! Say bet to play.',
     reprompt: 'Say bet to play',
    },
    WelcomeBack: {
     ask: 'Welcome back to Casino War! You have ${bankroll}. Say bet to play.',
     reprompt: 'Say bet to play',
    },
    AskForBet: {
     ask: 'How much would you like to bet?',
    },
    HandResultWinner: {
      say: '{dealtCards} You won! ',
    },
    HandResultLoser: {
      say: '{dealtCards} You lose. ',
    },
    HandResultReset: {
      say: '{dealtCards} You lose. You do not have enough to place the minimum bet. Resetting bankroll to ${bankroll}. ',
    },
    HandResultWithWar: {
      say: '{dealtCards} {warSound}',
    },
    HandResultWithWarAndSideBet: {
      say: '{dealtCards} {warSound} You won ${sideBetWin} from your side bet!',
    },
    WarTieResult: {
      say: '{dealtCards} It\'s another tie - you win ${tieWinAmount}!',
    },
    WarSurrender: {
      say: 'You surrender half your bet',
    },
    WarReset: {
      say: 'You surrender half your bet. You do not have enough to place the minimum bet. Resetting bankroll to ${bankroll}. ',
    },
    PlayAgain: {
      ask: 'Would you like to play again?',
      reprompt: 'Would you like to play again?',
    },
    AtWar: {
      ask: 'Say yes to go to war or no to surrender.',
      reprompt: 'Say yes to go to war or no to surrender.',
    },
    StartGame: {
      say: 'All right, let\'s start.',
    },
    NotEnoughForWar: {
      ask: 'You don\'t have enough money to place a war bet. Say no to surrender.',
      reprompt: 'Say no to surrender.',
    },
    NoHighScores: {
      ask: 'Sorry, I\'m unable to read the current leader board. What else can I help you with?',
      reprompt: 'Should we play again?',
    },
    HighScores: {
      ask: 'The top {rankNumber} bankrolls are ${rankLeaders}. What else can I help you with?',
      reprompt: 'Should we play again?',
    },
    HighScoresAndRank: {
      ask: 'You have ${rankBankroll} ranking you as <say-as interpret-as="ordinal">{rankRank}</say-as> of {rankPlayers} players. The top {rankNumber} bankrolls are ${rankLeaders}. What else can I help you with?',
      reprompt: 'Should we play again?',
    },
    Bye: {
      tell: 'That\'s all right, until next time!',
    },
  };
}());
module.exports = views;
