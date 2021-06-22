var txRepo;
var nsRepo;
var receiptRepo;
var transactionService;

var epochAdjustment;
var listener;
var blockRepo;
var nwRepo;
var accountRepo;
var nodeRepo;
var chainRepo;
var msigRepo;
var networkType;
var currencyId;
var totalChainImportance;
var currencyNamespaceId;

const nem = require("/node_modules/symbol-sdk");
const op = require("/node_modules/rxjs/operators");
const rxjs = require("/node_modules/rxjs");
const qr   = require("/node_modules/symbol-qr-library");


function connectNode(nodes,d){

	const node = nodes[Math.floor(Math.random() * nodes.length)] ;
	$.ajax({url:  node + "/node/health" ,type: 'GET',timeout: 1000})
	.then(res => {
		if(res.status.apiNode == "up" && res.status.db == "up"){
			console.log(node);
			return d.resolve(node);
		}
		return connectNode(nodes,d);
	})
	.catch(res =>connectNode(nodes,d));
	return d.promise();
}

async function createRepo(d2,nodes){

	const d = $.Deferred();
	const node = await connectNode(nodes,d);
	const repo = new nem.RepositoryFactoryHttp(node);

	try{
		epochAdjustment = await repo.getEpochAdjustment().toPromise();
		if(listener === undefined){
			const wsEndpoint = node.replace('http', 'ws') + "/ws";
			await listenerKeepOpening(wsEndpoint,repo.createNamespaceRepository());
		}
		d2.resolve(repo);

	}catch(error){
		console.log(error);
		createRepo(d2,nodes);
	}
	return d2.promise();
}

async function listenerKeepOpening(wsEndpoint,nsRepo){

	listener = new nem.Listener(wsEndpoint,nsRepo,WebSocket);
	await listener.open();

	listener.webSocket.onclose = async function(){
		console.log("listener onclose");
		onListenerResume();
		await listenerKeepOpening(wsEndpoint,nsRepo);
	}
}

(async() =>{

	const d2 = $.Deferred();
	const repo = await createRepo(d2,nodelist);

//	const d3 = $.Deferred();
//	const repo2 = await createRepo(d3,nodelist);

	txRepo = repo.createTransactionRepository();
	receiptRepo = repo.createReceiptRepository();
	chainRepo = repo.createChainRepository();
	nsRepo = repo.createNamespaceRepository();
	transactionService = new nem.TransactionService(txRepo, receiptRepo);

	nwRepo = repo.createNetworkRepository();
//	blockRepo = repo.createBlockRepository();
	blockRepo = repo.createBlockRepository();
	accountRepo = repo.createAccountRepository();
	nodeRepo = repo.createNodeRepository();
//	tsRepo = repo.createTransactionStatusRepository();
//	finRepo = repo.createFinalizationRepository();
//	hlRepo = repo.createHashLockRepository();
	metaRepo = repo.createMetadataRepository();
	mosaicRepo = repo.createMosaicRepository();
	msigRepo = repo.createMultisigRepository();
//	resAccountRepo = repo.createRestrictionAccountRepository();
//	resMosaicRepo = repo.createRestrictionMosaicRepository();
//	slRepo = repo.createSecretLockRepository();

	currencyId = (await repo.getCurrencies().toPromise()).currency.mosaicId.toHex();
	networkType = await repo.getNetworkType().toPromise();
	totalChainImportance = Number((await nwRepo.getNetworkProperties().toPromise()).chain.totalChainImportance.split("'").join('').slice( 0, -8 ));
	networkCurrency = (await repo.getCurrencies().toPromise()).currency;
	generationHash = await repo.getGenerationHash().toPromise();

	currencyNamespaceId = (new nem.NamespaceId("symbol.xym")).id.toHex();
	latestBlock = (await blockRepo.search({order: nem.Order.Desc}).toPromise()).data[0];

	divShow();

})();

function dispAmount(amount,divisibility){

	const strNum = amount.toString();
	if(divisibility > 0){

		if(amount < Math.pow(10, divisibility)){

			return "0." + paddingAmount0(strNum,0,divisibility);

		}else{

			const r = strNum.slice(-divisibility);
			const l = strNum.substring(0,strNum.length - divisibility);
			return comma3(l) + "." + r;
		}
	}else{
		return comma3(strNum);
	}
}
function comma3(strNum){
	return strNum.replace( /(\d)(?=(\d\d\d)+(?!\d))/g, '$1,');
}

function paddingAmount0(val,char,n){
	for(; val.length < n; val= char + val);
	return val;
}

function dispTimeStamp(timeStamp,epoch){

	const d = new Date(timeStamp + epoch * 1000)
	const strDate = d.getFullYear()%100
		+ "-" + paddingDate0( d.getMonth() + 1 )
		+ '-' + paddingDate0( d.getDate() )
		+ ' ' + paddingDate0( d.getHours() )
		+ ':' + paddingDate0( d.getMinutes() ) ;
	return 	strDate;
}

function getDateId(timeStamp,epoch){
	const d = new Date(timeStamp + epoch * 1000)
	const dateId = d.getFullYear()
		+ paddingDate0( d.getMonth() + 1 )
		+ paddingDate0( d.getDate() );
	return 	dateId;

}


function paddingDate0(num) {
	return ( num < 10 ) ? '0' + num  : num;
};

//選択中アカウントの完了トランザクション検知リスナー
const signedTxConfirmed = function(address,hash){

	const transactionObservable = listener.confirmed(address);
	const errorObservable = listener.status(address, hash);
	return rxjs.merge(transactionObservable, errorObservable).pipe(
		op.first(),
		op.map((errorOrTransaction) => {
			if (errorOrTransaction.constructor.name === "TransactionStatusError") {
				throw new Error(errorOrTransaction.code);
			} else {
				return errorOrTransaction;
			}
		}),
	);
}
