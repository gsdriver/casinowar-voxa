'use strict';

const seedrandom = require('seedrandom');

/**
 * Variables are the rendering engine way of adding logic into your views
 * See more http://voxa.readthedocs.io/en/latest/views-and-variables.html#variables
 */

module.exports = {
  userWins: model => model.userWins,
  alexaWins: model => model.alexaWins,
  rankBankroll: model => model.ranking.bankroll,
  rankRank: model => model.ranking.rank,
  rankPlayers: model => model.ranking.players,
  rankNumber: model => model.ranking.number,
  rankLeaders: model => model.ranking.leaders,
  bankroll: model => model[model.currentGame].bankroll,
  dealtCards: model => model.dealtCards,
  sideBetWin: model => 10 * model[model.currentGame].sideBet,
  tieWinAmount: model => (1 + model[model.currentGame].rules.tieBonus) * model[model.currentGame].bet,
  warSound: model => {
    const game = model[model.currentGame];
    const warSounds = parseInt(process.env.WARCOUNT);
    if (!isNaN(warSounds)) {
      const randomValue = seedrandom(model.userId + (game.timestamp ? game.timestamp : ''))();
      const choice = 1 + Math.floor(randomValue * warSounds);
      if (choice > warSounds) {
        choice--;
      }
      return `<audio src="https://s3-us-west-2.amazonaws.com/alexasoundclips/war/war${choice}.mp3"/>`;
    } else {
      return 'It\'s a tie!';
    }
  },
};

