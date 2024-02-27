echo "Get docker processes"
sudo docker ps

echo "Getting current id"
CURRENT_ID=$(sudo docker images 'd2-event-listener' -a -q)
echo "the current id is $CURRENT_ID"

echo "Building D2 Event Listener Image"

echo "Building..."
docker-compose -f docker-compose.yml up --build -no-cache -d --no-start

echo "Deleting/Stopping Demo containers"
sudo docker rmi $CURRENT_ID
sleep 1s
sudo docker stop $CURRENT_ID
sleep 1s
sudo docker rm $CURRENT_ID
sleep 1s

for id in $(docker ps -q)
do
    if [[ $(docker port "${id}") == *"3006"* ]]; then
        echo "stopping container ${id}"
        docker stop "${id}"
    fi
done

echo "Waiting 5 seconds to build again"
sleep 5s
docker-compose -f docker-compose.yml up --build -d
echo "Finished!"
echo "Get docker processes after the previous changes/updates"
sudo docker ps